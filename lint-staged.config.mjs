const linters = [
  ['apps/web/', "bun --filter '@scs/web' lint:fix"],
  ['apps/people/', "bun --filter '@scs/people' lint:fix"],
  ['apps/projects/', "bun --filter '@scs/projects' lint:fix"],
  ['apps/portal/', "bun --filter '@scs/portal' lint:fix"],
  ['services/api/', "bun --filter '@scs/api' lint:fix"],
  ['services/github-app/', "bun --filter '@scs/github-app' lint:fix"],
];

const typescriptFile = /\.(?:ts|tsx)$/i;
const prettierFile =
  /\.(?:css|html|js|json|jsonc|jsx|md|mdx|mjs|ts|tsx|ya?ml)$/i;

function quote(file) {
  return `"${file.replaceAll('"', '\\"')}"`;
}

export default (stagedFiles) => {
  const normalized = stagedFiles.map((file) => file.replaceAll('\\', '/'));
  const commands = linters
    .filter(([prefix]) =>
      normalized.some(
        (file) => file.includes(`/${prefix}`) && typescriptFile.test(file)
      )
    )
    .map(([, command]) => command);
  const prettierFiles = stagedFiles.filter((file) => {
    const normalizedFile = file.replaceAll('\\', '/');

    return (
      prettierFile.test(normalizedFile) && !normalizedFile.includes('/.agents/')
    );
  });

  if (prettierFiles.length > 0) {
    commands.push(`prettier --write ${prettierFiles.map(quote).join(' ')}`);
  }

  return commands;
};
