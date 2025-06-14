import { dlcSchema, modPortalSchema, modNameSchema, modVersionSchema, type AnyJson, baseSchema, anySchema } from './info-json-schema.js';
import { validateModPortal } from './mod-portal-validation.js';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod/v4';

const authorSchema = z.union([dlcSchema.shape.author, z.object({
  name: z.string().and(dlcSchema.shape.author),
})]);
const contactSchema = z.union([
  z.url({
    protocol: /^https?$/,
    hostname: z.regexes.domain
  }).and(dlcSchema.shape.contact),
  z.object({
    name: z.string().and(dlcSchema.shape.contact),
  })
]).optional();

const packageJsonSchema = z.object({
  name: modNameSchema,
  version: modVersionSchema,
  description: dlcSchema.shape.description,
  author: authorSchema,
  contributors: z.array(authorSchema).optional(),
  bugs: contactSchema.optional(),
  homepage: z.url({
    protocol: /^https?$/,
    hostname: z.regexes.domain
  }).optional().and(dlcSchema.shape.homepage),
  factorio: dlcSchema.omit({
    name: true, // name
    version: true, // version
    description: true, // description
    author: true, // author/contributors
    contact: true, // bugs
    homepage: true, // homepage
  })
});

const statuses = ['error', 'warning', 'pass'] as const;
type Status = typeof statuses[number];

export const generateInfoJson = async ({
  input,
  output,
  validateDependencies = true,
}: {
  input: string;
  output: string;
  validateDependencies?: boolean;
  }): Promise<Status> => {
  let status: Status = 'pass';
  const json = packageJsonSchema.safeParse(JSON.parse(await readFile(input, 'utf-8')));
  if (!json.success) {
    console.error(json.error);
    return 'error';
  }
  const infoJson: AnyJson = {
    name: json.data.name,
    version: json.data.version,
    author: typeof json.data.author === 'string' ? json.data.author : json.data.author.name + (json.data.contributors?.length ? `, ${json.data.contributors.map(c => typeof c === 'string' ? c : c.name).join(', ')}` : ''),
    contact: typeof json.data.bugs === 'string' ? json.data.bugs : json.data.bugs?.name,
    homepage: json.data.homepage,
    description: json.data.description,
    ...json.data.factorio,
  }
  const anyError = anySchema.safeParse(infoJson).error;
  if(anyError) {
    console.error(anyError);
    return 'error';
  }
  const modPortalError = modPortalSchema.safeParse(infoJson).error;
  if(modPortalError) {
    console.warn(modPortalError);
    status = 'warning';
  }
  if (validateDependencies) {
    const result = await validateModPortal(infoJson, {
      validateDependencies: true,
    });
    if (result.errors.length > 0) {
      console.error(result.errors);
      return 'error';
    }
    if (result.warnings.length > 0) {
      console.warn(result.warnings);
      status = 'warning';
    }
  }
  await writeFile(output, JSON.stringify(infoJson, null, 2));
  return status;
};