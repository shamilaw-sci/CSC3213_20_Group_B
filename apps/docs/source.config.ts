import { remarkMdxMermaid } from 'fumadocs-core/mdx-plugins';
import { defineConfig } from 'fumadocs-mdx/config';

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      langs: [
        'bash',
        'bat',
        'css',
        'dockerfile',
        'html',
        'javascript',
        'json',
        'markdown',
        'powershell',
        'python',
        'sql',
        'tsx',
        'typescript',
        'yaml',
      ],
      langAlias: {
        cmd: 'bat',
        md: 'markdown',
        ps1: 'powershell',
        shell: 'bash',
      },
    },
    remarkPlugins: [remarkMdxMermaid],
  },
});
