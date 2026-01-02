import {type ArrowTemplate, html} from "@arrow-js/core";

function extendAttributes(originalAttrs:{[attribute:string]:any},transformers:{[attribute:string]:(previousValue:any)=>any}={}){
    const newAttributes = {...originalAttrs};
    for(const [attribute, transformer] of Object.entries(transformers)){
        newAttributes[attribute] = transformer(newAttributes[attribute]);
    }
    return newAttributes;
}

/**
 * A generator for extendable templates that can be rendered. In other frameworks, this would be a "component generator"
 */
export class ArrowElementGenerator<T>{
    protected readonly attributes;
    protected readonly transform;
    protected readonly htmlTransform;

    /**
     * Creates an ArrowElement
     * @param type The underlying type of this element: div, span, etc
     * @param attributes The attributes on this element
     * @param optData Contains any optional data for this generator
     * @param optData.createTransform A function that gets run when {@link create} is called. See {@link create} for more info
     * @param optData.htmlTransform A function that takes the template that this element is created with and transforms it
     */
    constructor(attributes:{[attribute:string]:any}, optData:{
        createTransform?:(args:T, currentAttributes:{[attribute:string]:any})=>void,
        htmlTransform?:(inner:ArrowTemplate)=>ArrowTemplate
    }={}){
        this.attributes = attributes;
        this.createTransform=optData.createTransform || (()=>{});
        this.htmlTransform=optData.htmlTransform || ((inside)=>inside);
    }

    /**
     * Creates a new template from this generator, optionally adding some additional attributes
     * @param requiredValue The value you need to pass into this generator, specified when the generator was created (the `createTransform`)
     * @param attributes Additional HTML attributes to add to this element
     * @return A renderable {@link ArrowTemplate}
     */
    create(requiredValue:T, attributes:{[attribute:string]:(previousValue:any)=>any}={}){

        const newAttributes = {...this.attributes};
        this.createTransform(requiredValue, newAttributes);
        const newerAttributes = extendAttributes(newAttributes, attributes);
        const orderedContents = Object.entries(newerAttributes);

        const staticStringContents = [`<${this.type} `+(orderedContents.length===0?">":orderedContents[0]![0]+'="'),
            ...orderedContents.slice(1).map(data=>`" ${data[0]}="`),
            ...(orderedContents.length>0?['">']:[]), `</${this.type}>`] as unknown as TemplateStringsArray;
        // @ts-ignore
        staticStringContents.raw=[...staticStringContents];

        return (strings:TemplateStringsArray, ...expSlots: any[]) =>
            html(staticStringContents, ...[...orderedContents.map(data => data[1]),
                this.htmlTransform(html(strings, ...expSlots))]);
    }

    /**
     * Extends this generator to create a new one
     * @param attributes An object of callbacks, where each callback takes the old attribute and returns the new attribute.
     * If a value is passed in instead of a callback, the new value will overwrite the old value.
     * @param data Contains any additional data for this generator
     * @param data.newCreateTransform Takes the `requiredValue` from {@link create} and the attributes of this generator,
     * and applies the `requiredValue` to the attributes
     * @param data.newHtmlTransform Takes the previous htmlTransform function and returns a new htmlTransform function
     * @param type The node type of this template. Optional, will inherit from parent if not specified
     * @return A new {@link ArrowElementGenerator} with the specified attributes, type, and transform function
     */
    extend<T2>(attributes:{[attribute:string]:any}={},
               data:{
                   newCreateTransform:(superTransform: (args: T, currentAttributes: { [attribute: string]: any }) => void) =>
                       (args:T2, currentAttributes:{ [attribute:string]: any }) => void,
                   newHtmlTransform?:(superTransform: (inner:ArrowTemplate)=>ArrowTemplate) => (inner:ArrowTemplate)=>ArrowTemplate,
               },
               type?:string){

        return new ArrowElementGenerator(
            type || this.type,
            extendAttributes(
                this.attributes,
                Object.fromEntries(Object.entries(attributes).map(([k,v])=>
                    [k,typeof v === "function" ? v : ()=>v]))),
            {
                createTransform:data.newCreateTransform !== undefined ? data.newCreateTransform(this.createTransform) :
                    this.createTransform as unknown as ((a: T2, c: {[p: string]: any}) => void),
                htmlTransform:data.newHtmlTransform !== undefined ? data.newHtmlTransform(this.htmlTransform) :
                    this.htmlTransform
            });
    }
}

const defaultGenerator = new ArrowElementGenerator("",{}, {
    createTransform:()=>{},
    htmlTransform:(inner)=>inner
});
/**
 * Creates a new generator
 * @param type The node type of this template
 * @param attributes The attributes to add to all templates made by this generator
 * @param optData Contains any optional data for this generator
 * @param optData.createTransform A function that gets run when {@link create} is called. See {@link create} for more info
 * @param optData.htmlTransform A function that takes the template that this element is created with and transforms it
 * @return A new {@link ArrowElementGenerator} with the specified attributes, type, and transform function
 */
export default function createGenerator<T>(type:string, attributes:{[attribute:string]:any}={},
        optData:{
            createTransform?: (args:T, currentAttributes:{ [attribute:string]:any })=>void,
            htmlTransform?: ((inner:ArrowTemplate) => ArrowTemplate)
        }={}){
    return defaultGenerator.extend(Object.fromEntries(Object.entries(attributes).map(
        ([k, v]) => [k, ()=>v])),
        {
            newCreateTransform:optData.createTransform === undefined ?
                ()=>()=>{} :
                ()=>optData.createTransform!,
            newHtmlTransform:optData.htmlTransform === undefined ?
                ()=>(inner)=>inner :
                ()=>optData.htmlTransform!,
        }, type);
}
