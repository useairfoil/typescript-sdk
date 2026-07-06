import { Config, Option, Redacted } from "effect";

export type ConfigFieldSpec = {
  readonly name: string;
  readonly env: string;
  readonly type: "string" | "number" | "boolean" | "select";
  readonly required: boolean;
  readonly secret: boolean;
  readonly description?: string;
  readonly default?: string | number | boolean;
  readonly values?: ReadonlyArray<string>;
};

export type ConfigField<A> = {
  readonly make: (name: string) => Config.Config<A>;
  readonly spec: Omit<ConfigFieldSpec, "name">;
};

type FieldOptions<A extends string | number | boolean = string | number | boolean> = {
  readonly env: string;
  readonly required?: boolean;
  readonly description?: string;
  readonly default?: A;
};

export type FieldsRecord = Record<string, ConfigField<unknown>>;

type FieldValue<Field> = Field extends ConfigField<infer A> ? A : never;

export type ConfigOf<Fields extends FieldsRecord> = {
  readonly [Key in keyof Fields]: FieldValue<Fields[Key]>;
};

export type ConnectorConfigDef<Fields extends FieldsRecord> = {
  readonly fields: { readonly [Key in keyof Fields]: Config.Config<FieldValue<Fields[Key]>> };
  readonly config: Config.Config<ConfigOf<Fields>>;
  readonly spec: ReadonlyArray<ConfigFieldSpec>;
};

export type ConfigValuesOf<Def extends ConnectorConfigDef<FieldsRecord>> =
  Def extends ConnectorConfigDef<infer Fields> ? ConfigOf<Fields> : never;

const withDefault = <A extends string | number | boolean>(
  config: Config.Config<A>,
  defaultValue: A | undefined,
) => (defaultValue === undefined ? config : Config.withDefault(config, defaultValue));

export const string = (options: FieldOptions<string>): ConfigField<string> => ({
  make: () => withDefault(Config.string(options.env), options.default),
  spec: {
    env: options.env,
    type: "string",
    required: options.required ?? true,
    secret: false,
    ...(options.description !== undefined ? { description: options.description } : {}),
    ...(options.default !== undefined ? { default: options.default } : {}),
  },
});

export const number = (options: FieldOptions<number>): ConfigField<number> => ({
  make: () => withDefault(Config.number(options.env), options.default),
  spec: {
    env: options.env,
    type: "number",
    required: options.required ?? true,
    secret: false,
    ...(options.description !== undefined ? { description: options.description } : {}),
    ...(options.default !== undefined ? { default: options.default } : {}),
  },
});

export const boolean = (options: FieldOptions<boolean>): ConfigField<boolean> => ({
  make: () => withDefault(Config.boolean(options.env), options.default),
  spec: {
    env: options.env,
    type: "boolean",
    required: options.required ?? true,
    secret: false,
    ...(options.description !== undefined ? { description: options.description } : {}),
    ...(options.default !== undefined ? { default: options.default } : {}),
  },
});

export const select = <const Values extends ReadonlyArray<string>>(options: {
  readonly env: string;
  readonly required?: boolean;
  readonly values: Values;
  readonly description?: string;
  readonly default?: Values[number];
}): ConfigField<Values[number]> => ({
  make: () => withDefault(Config.literals(options.values, options.env), options.default),
  spec: {
    env: options.env,
    type: "select",
    required: options.required ?? true,
    secret: false,
    values: options.values,
    ...(options.description !== undefined ? { description: options.description } : {}),
    ...(options.default !== undefined ? { default: options.default } : {}),
  },
});

export const secret = (options: {
  readonly env: string;
  readonly required?: boolean;
  readonly description?: string;
  readonly default?: string;
}): ConfigField<Redacted.Redacted<string>> => ({
  make: () =>
    options.default === undefined
      ? Config.redacted(options.env)
      : Config.withDefault(Config.redacted(options.env), Redacted.make(options.default)),
  spec: {
    env: options.env,
    type: "string",
    required: options.required ?? true,
    secret: true,
    ...(options.description !== undefined ? { description: options.description } : {}),
    ...(options.default !== undefined ? { default: options.default } : {}),
  },
});

export const optional = <A>(field: ConfigField<A>): ConfigField<Option.Option<A>> => ({
  make: (name) => Config.option(field.make(name)),
  spec: {
    ...field.spec,
    required: false,
  },
});

export const define = <const Fields extends FieldsRecord>(
  fields: Fields,
): ConnectorConfigDef<Fields> => {
  const configFields = Object.fromEntries(
    Object.entries(fields).map(([name, field]) => [name, field.make(name)]),
  ) as ConnectorConfigDef<Fields>["fields"];

  return {
    fields: configFields,
    config: Config.all(configFields) as Config.Config<ConfigOf<Fields>>,
    spec: Object.entries(fields).map(([name, field]) => ({ name, ...field.spec })),
  };
};
