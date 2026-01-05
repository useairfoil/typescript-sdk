export type EnumKeys<E> = Extract<keyof E, string>;

export type Prettify<T> = { [K in keyof T]: T[K] } & {};
