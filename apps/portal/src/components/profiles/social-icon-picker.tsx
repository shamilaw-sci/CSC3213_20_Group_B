'use client';

import type { SocialIcon } from '@scs/schemas';
import { Button } from '@scs/ui/components/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@scs/ui/components/command';
import { ExternalLink, Search } from 'lucide-react';
import { useState } from 'react';
import type { IconType } from 'react-icons';
import {
  SiAcademia,
  SiArxiv,
  SiBitbucket,
  SiBlogger,
  SiDatacamp,
  SiDevdotto,
  SiDiscord,
  SiFigshare,
  SiGitlab,
  SiGooglescholar,
  SiHuggingface,
  SiKaggle,
  SiLinktree,
  SiMedium,
  SiOpenaccess,
  SiOrcid,
  SiPinterest,
  SiReddit,
  SiResearchgate,
  SiSignal,
  SiSnapchat,
  SiStackoverflow,
  SiSubstack,
  SiTelegram,
  SiThreads,
  SiTiktok,
  SiTumblr,
  SiTwitch,
  SiWechat,
  SiWhatsapp,
  SiWordpress,
  SiZenodo,
} from 'react-icons/si';

const ICONS: Array<{ label: string; slug: string; Icon: IconType }> = [
  { label: 'Academia.edu', slug: 'academia', Icon: SiAcademia },
  { label: 'arXiv', slug: 'arxiv', Icon: SiArxiv },
  { label: 'Bitbucket', slug: 'bitbucket', Icon: SiBitbucket },
  { label: 'Blogger', slug: 'blogger', Icon: SiBlogger },
  { label: 'DataCamp', slug: 'datacamp', Icon: SiDatacamp },
  { label: 'DEV', slug: 'devdotto', Icon: SiDevdotto },
  { label: 'Discord', slug: 'discord', Icon: SiDiscord },
  { label: 'Figshare', slug: 'figshare', Icon: SiFigshare },
  { label: 'GitLab', slug: 'gitlab', Icon: SiGitlab },
  { label: 'Google Scholar', slug: 'googlescholar', Icon: SiGooglescholar },
  { label: 'Hugging Face', slug: 'huggingface', Icon: SiHuggingface },
  { label: 'Kaggle', slug: 'kaggle', Icon: SiKaggle },
  { label: 'Linktree', slug: 'linktree', Icon: SiLinktree },
  { label: 'Medium', slug: 'medium', Icon: SiMedium },
  { label: 'Open Access', slug: 'openaccess', Icon: SiOpenaccess },
  { label: 'ORCID', slug: 'orcid', Icon: SiOrcid },
  { label: 'Pinterest', slug: 'pinterest', Icon: SiPinterest },
  { label: 'Reddit', slug: 'reddit', Icon: SiReddit },
  { label: 'ResearchGate', slug: 'researchgate', Icon: SiResearchgate },
  { label: 'Signal', slug: 'signal', Icon: SiSignal },
  { label: 'Snapchat', slug: 'snapchat', Icon: SiSnapchat },
  { label: 'Stack Overflow', slug: 'stackoverflow', Icon: SiStackoverflow },
  { label: 'Substack', slug: 'substack', Icon: SiSubstack },
  { label: 'Telegram', slug: 'telegram', Icon: SiTelegram },
  { label: 'Threads', slug: 'threads', Icon: SiThreads },
  { label: 'TikTok', slug: 'tiktok', Icon: SiTiktok },
  { label: 'Tumblr', slug: 'tumblr', Icon: SiTumblr },
  { label: 'Twitch', slug: 'twitch', Icon: SiTwitch },
  { label: 'WeChat', slug: 'wechat', Icon: SiWechat },
  { label: 'WhatsApp', slug: 'whatsapp', Icon: SiWhatsapp },
  { label: 'WordPress', slug: 'wordpress', Icon: SiWordpress },
  { label: 'Zenodo', slug: 'zenodo', Icon: SiZenodo },
];

export function SocialIconPicker({
  value,
  onChange,
}: {
  value?: SocialIcon;
  onChange: (value: SocialIcon) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected =
    value?.type === 'simple-icons'
      ? ICONS.find((entry) => entry.slug === value.slug)
      : null;
  const SelectedIcon = selected?.Icon ?? ExternalLink;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start"
        onClick={() => setOpen(true)}
      >
        <SelectedIcon className="size-4" aria-hidden="true" />
        {selected?.label ?? 'Search icon library'}
        <Search className="ml-auto size-4" aria-hidden="true" />
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Choose a link icon"
        description="Search the available brand icons. Use arrow keys and Enter to select."
      >
        <CommandInput placeholder="Search icons..." autoFocus />
        <CommandList>
          <CommandEmpty>No matching icon.</CommandEmpty>
          <CommandGroup heading="Brand icons">
            {ICONS.map(({ label, slug, Icon }) => (
              <CommandItem
                key={slug}
                value={`${label} ${slug}`}
                onSelect={() => {
                  onChange({ type: 'simple-icons', slug });
                  setOpen(false);
                }}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
