import {type ArrowTemplate, html, reactive} from "@arrow-js/core";
import {ref} from "./utils.js";

const getRouteSymbol = Symbol("getRoute");
type routeType = {[subPath:string]:routeType, [getRoute:symbol]:(variables:{[variableName:string]:string})=>ArrowTemplate};
type routeWithVariables = {subRoutes:routeType, variables:{[k:string]:string}}

function getPath(routes:routeType, subPaths:string[], variables:{[k:string]:string}={}):routeWithVariables|routeWithVariables[]|undefined {
    if (subPaths.length === 0 && routes[getRouteSymbol] !== undefined) return {subRoutes:routes, variables};

    //regular path
    if (routes[subPaths[0]!] !== undefined) {
        if(routes[subPaths[0]!] !== undefined)
            return getPath(routes[subPaths[0]!]!, subPaths.slice(1), {...variables});
    }

    //variable path
    const toReturn:routeWithVariables[] = [];
    for (const key in routes) {
        if (!key.startsWith(":") || routes[key] === undefined) continue;

        const maybeRoute = getPath(routes[key], subPaths.slice(1), {
            ...variables,
            [key.slice(1)]:subPaths[0]!
        });
        if(maybeRoute instanceof Array) toReturn.push(...maybeRoute);
        else if(maybeRoute !== undefined) toReturn.push(maybeRoute);
    }

    if(toReturn.length>0) return toReturn;
}

const default404 = html`404`;

/**
 * A basic router
 */
export default class Router{
    protected readonly routes:routeType={};
    protected readonly route404:ArrowTemplate;

    /**
     * Creates a router
     * @param route404 The template to render if no other path was found. Defaults to "404" text
     */
    constructor(route404:ArrowTemplate=default404) {
        this.route404 = route404;
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
    addRoute(path:string, renderTemplate:(variables:{[variableName:string]:string})=>ArrowTemplate){
        const subPaths = path.split("/");

        let position = this.routes;
        for(const nextPos of subPaths) {
            if(position[nextPos] !== undefined) position = position[nextPos];
            else position=position[nextPos]={};
        }

        position[getRouteSymbol] = renderTemplate;

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
        const path = getPath(this.routes, location.split("/"));

        if(path instanceof Array) {
            if(path.length === 0) return undefined;
            if(path[0]!.subRoutes[getRouteSymbol] === undefined) return undefined;
            return path[0]!.subRoutes[getRouteSymbol]!(path[0]!.variables);
        }else if(path !== undefined && path.subRoutes[getRouteSymbol] !== undefined)
            return path.subRoutes[getRouteSymbol]!(path.variables);
    }
}

const differentPage = /^[A-Za-z]+:\/\/.*$/;
/**
 * A router that can manages the web page based on the page's url
 */
export class PageAttachedRouter extends Router{
    protected readonly rootElement;
    protected readonly location = ref<string[]>([]);
    protected readonly transformBeforeRender;

    /**
     * Creates a page attached router
     * @param attachTo The dom element to attach this router to. Defaults to `document.body`
     * @param route404 The template to render if no other path was found. Defaults to "404" text
     * @param onRender Callback run when the page is rendered
     */
    constructor(attachTo:HTMLElement|undefined, route404?:ArrowTemplate, transformBeforeRender?:(template:ArrowTemplate)=>ArrowTemplate) {
        super(route404);
        this.rootElement = attachTo;
        this.transformBeforeRender = transformBeforeRender || (template => template);

        this.location.$on(()=> this.rerender());
        window.addEventListener("popstate", e => {
            if(!this.redirect(window.location.pathname)) e.preventDefault();
        });//back button handling
    }

    /**
     * Rerenders the page (and calls `this.onRender` if it was defined)
     */
    public rerender(){
        const path = this.getPath(this.location.value.join("/"));
        if(this.rootElement !== undefined) {
            this.rootElement.replaceChildren();
            html`${this.transformBeforeRender(path)}`(this.rootElement);
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
