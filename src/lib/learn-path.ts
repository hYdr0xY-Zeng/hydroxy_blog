export const learnSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeLearnSlug(value: string) {
  const slug = value.trim();
  if (!learnSlugPattern.test(slug)) throw new Error('Learn slug must use lowercase letters, numbers, and hyphens only.');
  return slug;
}

export function normalizeLearnParentPath(value: string | undefined) {
  const parent = (value ?? '').trim();
  if (parent && parent.split('/').some((segment) => !segment || segment === '.' || segment === '..' || /[\\?#%\u0000-\u0020\u007f]/.test(segment))) {
    throw new Error('Learn parent path is invalid.');
  }
  return parent;
}

export const learnPathFor = (parent: string, slug: string) => parent ? `${parent}/${slug}` : slug;

export function resolveLearnDocumentPath(parent: string, value: string, originalPath?: string) {
  const slug = value.trim();
  const path = learnPathFor(parent, slug);
  // Imported URLs remain valid only when the entire original path is unchanged.
  if (!originalPath || path !== originalPath) normalizeLearnSlug(slug);
  return path;
}
