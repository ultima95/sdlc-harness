// Minimal YAML front-matter field editor for the harness's own task files.
// Operates only inside the leading `---` ... `---` block.
export function setFrontMatterField(md, key, value) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) throw new Error('no front-matter block found');
  const block = m[1];
  const re = new RegExp(`^(${key}:)[^\\n]*$`, 'm');
  const line = `${key}: ${value}`;
  const newBlock = re.test(block)
    ? block.replace(re, () => line)
    : `${block}\n${line}`;
  return md.replace(block, newBlock);
}
