import {type ArrowTemplate, html, reactive} from "@arrow-js/core";
import {ref} from "./utils.js";

const getRouteSymbol = Symbol("getRoute");
const routerSymbol = Symbol("router");
type getRoute = (variables:{[variableName:string]:string})=>ArrowTemplate;
type routeType = {[subPath:string]:routeType, [getRouteOrRouter:symbol]:getRoute|Router};

const default404 = html`404`;

/**
 * A basic router
 */
export default class Router{
    protected readonly routes:routeType={};
    protected readonly route404:ArrowTemplate;
    protected readonly transformBeforeFetch;

    /**
     * Creates a router
     * @param route404 The template to render if no other path was found. Defaults to "404" text
     * @param transformBeforeFetch An optional function that can transform the path before it's fetched (either in {@link getPath} or {@link getPathNo404}
     */
    constructor(route404:ArrowTemplate=default404, transformBeforeFetch?:(template:ArrowTemplate, vars:{[variableName:string]:string})=>ArrowTemplate) {
        this.route404 = route404;
        this.transformBeforeFetch = transformBeforeFetch || (template => template);
    }

    /**
     * Adds a route to this router
     *
     * The `path` can include variables; to do this, prefix some section with ":". When calling {@link getPath} or
     * {@link getPathNo404}, the `variables` object will include the variable.
     *
     * EX: if the route `path/to/:variableName/render` is defined, fetching the location `path/to/someValue/render` will
     * result in\
     * `{ ... variables: { ... variableName: "someValue" } }`
     *
     * @param path The location to render at. Should be of the form `path/to/render`, with no slash at the beginning
     * or end (unless you know what you're doing)
     * @param renderTemplate The template to render at this location
     */
    addRoute(path:string, renderTemplate:((variables:{[variableName:string]:string})=>ArrowTemplate)|Router){
        const subPaths = path.split("/");

        let position = this.routes;
        for(let i=0;i<subPaths.length;i++){
            const nextPos = subPaths[i]!;

            if(position[nextPos] !== undefined && position[nextPos][routerSymbol] instanceof Router && i !== subPaths.length-1)
                throw new Error(`Cannot create route "${path}", there is a router in the way`);
            if(position[nextPos] !== undefined && i !== subPaths.length-1 && !(renderTemplate instanceof Router)) position = position[nextPos];
            else{
                if(i === subPaths.length-1 && renderTemplate instanceof Router) {
                    position[nextPos]||={};
                    position[nextPos][routerSymbol] = renderTemplate;
                }
                else position=position[nextPos]={};
            }
        }

        if(!(renderTemplate instanceof Router)) position[getRouteSymbol] = renderTemplate;

        return this;
    }

    /**
     * Gets the template to render from the given location. Will default to the 404 path if no path found
     * @param location The location to fetch
     */
    getPath(location:string) {
        return this.getPathNo404(location) || this.route404;
    }
    /**
     * Gets the template to render from the given location. Will return undefined if no path found
     * @param location The location to fetch
     */
    getPathNo404(location:string){
        const vars = {};
        const pathOptions = this.getPathInternal(this.routes, location.split("/"), vars);

        if(pathOptions === undefined || pathOptions.length === 0 || pathOptions[0] === undefined) return undefined;
        return this.transformBeforeFetch(pathOptions[0]!, vars);
    }

    /**
     * @return this router's 404 route
     */
    get404(){ return this.route404; }
    /**
     * @return `this.routes`. If you want just a single route, try {@link getPath}
     */
    accessRoutes(){ return this.routes; }

    private getPathInternal(routes:routeType, subPaths:string[], variables:{[k:string]:string}):ArrowTemplate[]|undefined {
        if (subPaths.length === 0 && routes[getRouteSymbol] !== undefined)
            return [(routes[getRouteSymbol] as getRoute)(variables)];

        //regular path
        if (routes[subPaths[0]!] !== undefined) {
            if(routes[subPaths[0]!] !== undefined) {
                const next = routes[subPaths[0]!]!;
                if(next[routerSymbol] instanceof Router && subPaths.length>1){
                    return (next[routerSymbol].getPathInternal(next[routerSymbol].accessRoutes(), subPaths.slice(1), {...variables}) ?? [])
                        .map(template => (next[routerSymbol] as Router).transformBeforeFetch(template, {...variables}));
                }else return this.getPathInternal(next, subPaths.slice(1), {...variables});
            }
        }

        //variable path
        const toReturn:ArrowTemplate[] = [];
        for (const key in routes) {
            if (!key.startsWith(":") || routes[key] === undefined) continue;

            const maybeRoute = this.getPathInternal(routes[key][routerSymbol] instanceof Router ?
                routes[key][routerSymbol].accessRoutes() : routes[key], subPaths.slice(1), {
                ...variables,
                [key.slice(1)]:subPaths[0]!
            });
            if(maybeRoute !== undefined) toReturn.push(...maybeRoute);
        }

        if(toReturn.length>0) return toReturn;
    }
}

const differentPage = /^[A-Za-z]+:\/\/.*$/;
/**
 * A router that can manages the web page based on the page's url
 */
export class PageAttachedRouter extends Router{
    protected readonly rootElement;
    protected readonly location = ref<string[]>([]);

    /**
     * Creates a page attached router
     * @param attachTo The dom element to attach this router to. Defaults to `document.body`
     * @param route404 The template to render if no other path was found. Defaults to "404" text
     * @param transformBeforeFetch An optional function that can transform the path before it's {@link rerender}ed
     */
    constructor(attachTo:HTMLElement|undefined, route404?:ArrowTemplate,
                transformBeforeFetch?:(template:ArrowTemplate, vars:{[variableName:string]:string})=>ArrowTemplate) {
        super(route404, transformBeforeFetch);
        this.rootElement = attachTo;

        this.location.$on(()=> this.rerender());
        window.addEventListener("popstate", e => {
            if(!this.redirect(window.location.pathname)) e.preventDefault();
        });//back button handling
    }

    /**
     * Rerenders the page
     */
    public rerender(){
        const path = this.getPath(this.location.value.join("/"));
        if(this.rootElement !== undefined) {
            this.rootElement.replaceChildren();
            path(this.rootElement);
        }
    }

    /**
     * Updates the window's `location` and rerenders the page
     * @param newLocation The new url
     * @param replace Whether this new url should replace the current url in history or be a new entry
     * @return If the link leads to a new domain (or starts with [a-z]://)
     */
    redirect(newLocation:string=window.location.pathname, replace?:false){
        if(newLocation.startsWith("/")) this.location.value = newLocation.split("/").slice(1);
        else if(newLocation.match(differentPage) !== null) return true;
        else this.location.value = this.location.value.concat(newLocation.split("/"));

        // modalContents.val=undefined;

        const newPath = newLocation.split("/");
        if (newPath[0] === "") {
            this.location.value = newPath.slice(1);
        } else {
            this.location.value = this.location.value.concat(newPath);
        }

        window.history[replace ? "replaceState" : "pushState"](null, "", "/" + this.location.value.join("/"));
        return false;
    }
}
