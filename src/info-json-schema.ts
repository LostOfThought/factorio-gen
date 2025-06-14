import { z } from 'zod/v4';

export const modNameSchema = z.string().max(100, `Mod name must be at most 100 characters`).meta({
    description: `Mandatory field. The internal name of mod. The game accepts anything as a mod name, however the mod portal restricts mod names to only consist of alphanumeric characters, dashes and underscores. Note that the mod folder or mod zip file name has to contain the mod name, where the restrictions of the file system apply.

The game accepts mod names with a maximum length of 100 characters. The mod portal only accepts mods with names that are longer than 3 characters and shorter than 50 characters.`,
});

const getVersionPartSchema = (min = 0, max = 0) => z.number()
  .min(min, `Version must be at least ${min}`)
  .max(max, `Version must be at most ${max}`);
const defaultVersionPartSchema = getVersionPartSchema(0, 65535);
export const modVersionSchema = z.templateLiteral([defaultVersionPartSchema, '.', defaultVersionPartSchema, '.', defaultVersionPartSchema])
  .meta({
    description: `Mandatory field. Defines the version of the mod in the format "number.number.number" for "Major.Middle.Minor", for example "0.6.4". Each number can range from 0 to 65535.`
  });

const dependencySchema = z.union([
  modNameSchema,
  z.templateLiteral(['!', ' ', modNameSchema]),
  z.templateLiteral([z.enum(['?', '(?)', '~']), ' ', modNameSchema, z.union([z.literal(''), z.templateLiteral([' ', z.enum(['<', '<=', '=', '>=', '>']), ' ', modVersionSchema])])]),
])
  .meta({
    description: `Dependency specification. Can be a simple mod name, or include relation prefixes (!,?,(?),~) and version constraints (<,<=,=,>=,>).`,
  });

export const baseSchema = z.object({
  name: modNameSchema,
  version: modVersionSchema,
  title: z.string().max(100, `Title must be at most 100 characters`)
    .meta({
      description: `Mandatory field. The display name of the mod, so it is not recommended to use someUgly_pRoGrAmMeR-name here. Can be overwritten with a locale entry in the mod-name category, using the internal mod name as the key.

The game will reject a title field that is longer than 100 characters. However, this can be worked around by using the locale entry. The mod portal does not restrict mod title length.`,
  }),
  author: z.string()
    .meta({
      description: `Mandatory field. The author of the mod. This field does not have restrictions, it can also be a list of authors etc. The mod portal ignores this field, it will simply display the uploader's name as the author.`,
    }),
  contact: z.string()
    .optional()
    .meta({
      description: `Optional field. How the mod author can be contacted, for example an email address.`,
    }),
  homepage: z.url({
      protocol: /^https?$/,
      hostname: z.regexes.domain
    })
    .optional()
    .meta({
      description: `Optional field. Where the mod can be found on the internet. Note that the in-game mod browser shows the mod portal link additionally to this field. Please don't put "None" here, it makes the field on the mod portal website look ugly. Just leave the field empty if the mod doesn't have a website/forum thread/discord.`
    }),
  description: z.string()
    .optional()
    .meta({
      description: `Optional field. A short description of what your mod does. This is all that people get to see in-game. Can be overwritten with a locale entry in the mod-description category, using the internal mod name as the key.`,
    }),
  factorio_version: z.templateLiteral([defaultVersionPartSchema, '.', defaultVersionPartSchema])
    .default(`0.12`)
    .meta({
      description: `Optional field in the format "major.minor". The Factorio version that this mod supports. This can only be one Factorio version, not multiple. However, it includes all .sub versions. While the field is optional, usually mods are developed for versions higher than the default 0.12, so the field has to be added anyway.

Adding a sub part, e.g. "0.18.27" will make the mod portal reject the mod and the game act weirdly. That means this shouldn't be done; use only the major and minor components "major.minor", for example "1.0".

Mods with the factorio_version "0.18" can also be loaded in 1.0 and the mod portal will return them when queried for factorio_version 1.0 mods.`,
    }),
  dependencies: z.array(dependencySchema)
    .default(['base'])
    .meta({
      description: `Optional field. Mods that this mod depends on or is incompatible with. If this mod depends on another, the other mod will load first, see Data lifecycle. An empty array allows to work around the default and have no dependencies at all.`,
    }),
});


export const dlcSchema = z.object({
  ...baseSchema.shape,
  factorio_version: z.templateLiteral([getVersionPartSchema(2), '.', defaultVersionPartSchema]),
  quality_required: z.boolean()
    .default(false)
    .meta({
    description: `Optional field. Mods that require 2.0 Quality DLC feature.`,
  }),
  space_travel_required: z.boolean()
    .default(false)
    .meta({
      description: `Optional field. Mods that require 2.0 Space travel DLC feature.`,
    }),
  spoiling_required: z.boolean()
    .default(false)
    .meta({
      description: `Optional field. Mods that require 2.0 Spoiling DLC feature.`,
    }),
  freezing_required: z.boolean()
    .default(false)
    .meta({
      description: `Optional field. Mods that require 2.0 Freezing DLC feature.`,
    }),
  segmented_units_required: z.boolean()
    .default(false)
    .meta({
      description: `Optional field. Mods that require 2.0 Segmented units DLC feature.`,
    }),
  expansion_shaders_required: z.boolean()
    .default(false)
    .meta({
      description: `Optional field. Mods that require 2.0 Expansion shaders DLC feature.`,
    }),
});

export const infoJsonSchema = z.union([dlcSchema, baseSchema]);

export const modPortalSchema = infoJsonSchema.and(z.object({
  name: z.string().min(3, `Mod portal requires at minimum 3 characters`).max(50, `Mod portal requires at maximum 50 characters`).regex(/^[a-zA-Z0-9_-]+$/, `Mod portal name must contain only letters, numbers, underscores, and hyphens`),
}));

export const anySchema = z.union([modPortalSchema, infoJsonSchema]);


export type BaseJson = z.infer<typeof baseSchema>;
export type DlcJson = z.infer<typeof dlcSchema>;
export type InfoJson = z.infer<typeof infoJsonSchema>;
export type ModPortalJson = z.infer<typeof modPortalSchema>;
export type AnyJson = z.infer<typeof anySchema>;

export type Dependencies = z.infer<typeof dependencySchema>;

const RelationMarkers = ['!', '?', '(?)', '~'] as const;
export type Relation = typeof RelationMarkers[number];

const CompareMarkers = ['<', '<=', '=', '>=', '>'] as const;
export type Compare = typeof CompareMarkers[number];

export type Dependency = {
  name: string;
  relation?: Relation;
  compare?: Compare;
  version?: {
    major: number;
    minor: number;
    patch: number;
  };
};

const parseDependencyString = (dep: string): Dependency => {
  let processing = dep;
  const relation = RelationMarkers.find(relation => dep.startsWith(relation)) as Relation | undefined;
  if (relation) {
    processing = processing.slice(relation.length + 1);
  }
  const versionMatch = /(?<all>(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+))$/.exec(processing);
  let version: {
    all: string;
    major: string;
    minor: string;
    patch: string;
  } | undefined;
  if (versionMatch?.groups) {
    version = versionMatch.groups as {
      all: string;
      major: string;
      minor: string;
      patch: string;
    };
    processing = processing.slice(0, processing.length - version.all.length - 1);
  }
  const compare = CompareMarkers.find(compare => processing.endsWith(compare)) as Compare | undefined;
  if (compare) {
    processing = processing.slice(0, processing.length - compare.length - 1);
  }
  return {
    name: processing,
    ...(relation ? { relation } : {}),
    ...(compare ? { compare } : {}),
    ...(version ? { version: {
      major: Number.parseInt(version.major, 10),
      minor: Number.parseInt(version.minor, 10),
      patch: Number.parseInt(version.patch, 10),
    }} : {}),
  };
}

export const internalToParsed = <T extends AnyJson>(internal: Omit<T, 'dependencies' | 'factorio_version'> & {
  factorio_version: {
    major: number;
    minor: number;
  };
  dependencies: Dependency[];
}): InfoJson => {
  return {
    ...internal,
    factorio_version: `${internal.factorio_version.major}.${internal.factorio_version.minor}`,
    dependencies: internal.dependencies.map(dep =>
      `${dep.relation ? `${dep.relation} ` : ''}${dep.name}${dep.compare ? ` ${dep.compare} ${dep.version?.major}.${dep.version?.minor}.${dep.version?.patch}` : ''}`),
  };
};

export const parsedToInternal = <T extends AnyJson>(parsed: T): Omit<T, 'dependencies' | 'factorio_version'> & {
  factorio_version: {
    major: number;
    minor: number;
  };
  dependencies: Dependency[];
} => {
  return {
    ...parsed,
    factorio_version: {
      major: Number.parseInt(parsed.factorio_version.split('.')[0]!, 10),
      minor: Number.parseInt(parsed.factorio_version.split('.')[1]!, 10),
    },
    dependencies: parsed.dependencies.map(dep => parseDependencyString(dep)),
  };
};

export const isBase = (json: AnyJson): json is BaseJson => {
  return baseSchema.safeParse(json).success;
};

export const isDlc = (json: AnyJson): json is DlcJson => {
  return dlcSchema.safeParse(json).success;
};

export const isModPortal = (json: AnyJson): json is ModPortalJson => {
  return modPortalSchema.safeParse(json).success;
};

export const isModPortalBase = (json: AnyJson): json is ModPortalJson & BaseJson => {
  return isModPortal(json) && isBase(json);
};

export const isModPortalDlc = (json: AnyJson): json is ModPortalJson & DlcJson => {
  return isModPortal(json) && isDlc(json);
};

