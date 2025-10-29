import {reactive} from "@arrow-js/core";

/**
 * Creates a simple watchable value. You can access the value with `.value`\
 * Shortcut for `new Ref(...)`
 * @param defaultValue the default value
 */
export function ref<T>(defaultValue:T){
    return new Ref(defaultValue);
}
/**
 * A simple watchable value. You can access the value with `.value`
 * @param defaultValue the default value
 */
export class Ref<T>{
    protected readonly internalReactive;
    constructor(defaultValue:T) {
        this.internalReactive = reactive({value:defaultValue});
    }
    get value():T{ return this.internalReactive.value as T; }
    set value(value:T){ this.internalReactive.value = value as any; }

    /**
     * Adds an observer to a given property
     * @param property - The property to watch
     * @param callback - The callback to call when the property changes
     */
    $on(callback: (value: T, oldValue: T) => void){
        this.internalReactive.$on("value", callback);
    }
    /**
     * Removes an observer from a given property
     * @param property - The property to stop watching
     * @param callback - The callback to stop calling when the property changes
     */
    $off(callback: (value: T, oldValue: T) => void){
        this.internalReactive.$on("value", callback);
    }
}

//--

