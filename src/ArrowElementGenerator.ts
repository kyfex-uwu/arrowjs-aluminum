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
    public readonly type;
    protected readonly attributes;
    protected readonly createTransform;

    /**
     * Creates an ArrowElement
     * @param type The underlying type of this element: div, span, etc
     * @param attributes The attributes on this element
     * @param createTransform A function that gets run when {@link create} is called. See {@link create} for more info
     */
    constructor(type:string, attributes:{[attribute:string]:any},
                createTransform:(args:T, currentAttributes:{[attribute:string]:any})=>void){
        this.type = type;
        this.attributes = attributes;
        this.createTransform=createTransform;
    }

    /**
     * Creates a new template from this generator, optionally adding some additional attributes
     * @param requiredValue The value you need to pass into this generator, specified when the generator was created (the `createTransform`)
     * @param attributes Additional attributes to add to this template
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
            html(staticStringContents, ...[...orderedContents.map(data => data[1]), html(strings, ...expSlots)]);
    }

    /**
     * Creates a new generator based on this one
     * @param attributes An object of callbacks, where each callback takes the old attribute and returns the new attribute.
     * If a value is passed in instead of a callback, the new value will overwrite the old value.
     * @param newCreateTransform Takes the `requiredValue` from {@link create} and the attributes of this generator,
     * and applies the `requiredValue` to the attributes
     * @param type The node type of this template. Optional, will inherit from parent if not specified
     * @return A new {@link ArrowElementGenerator} with the specified attributes, type, and transform function
     */
    extend<T2>(attributes:{[attribute:string]:(previousValue:any)=>any}={},
            newCreateTransform:(superTransform: (args: T, currentAttributes: {
                [attribute: string]: any
            }) => void) =>
                (args:T2, currentAttributes:{
                    [attribute:string]: any
                }) => void,
            type?:string){

        return new ArrowElementGenerator(type || this.type, extendAttributes(this.attributes,
            Object.fromEntries(Object.entries(attributes).map(([k,v])=>
                [k,typeof v === "function" ? v : ()=>v]))), newCreateTransform(this.createTransform));
    }
}

const defaultGenerator = new ArrowElementGenerator("",{}, ()=>{});
/**
 * Creates a new generator
 * @param type The node type of this template
 * @param attributes The attributes to add to all templates made by this generator
 * @param createTransform A function that gets run when {@link create} is called. See {@link create} for more info
 * @return A new {@link ArrowElementGenerator} with the specified attributes, type, and transform function
 */
export default function createGenerator<T>(type:string, attributes:{[attribute:string]:any}={},
        createTransform: (args:T, currentAttributes:{
            [attribute:string]:any
        })=>void = ()=>{}){
    return defaultGenerator.extend(Object.fromEntries(Object.entries(attributes).map(
        ([k, v]) => [k, ()=>v])),
        ()=>createTransform, type);
}
