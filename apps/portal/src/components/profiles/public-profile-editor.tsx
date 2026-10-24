'use client';

import {
  AcademicDepartmentCodeSchema,
  AcademicRankSchema,
  AcademicSubjectCodeSchema,
  AcademicSupportPositionSchema,
  type AcademicSupportStaff,
  AcademicSupportStaffSchema,
  type AcademicTeachingStaff,
  AcademicTeachingStaffSchema,
  AcademicUnitCodeSchema,
  detectKnownSocialUrl,
  HonoursProgrammeCodeSchema,
  HonoursProgrammeDepartmentMap,
  type KnownSocialPlatform,
  type MutationAccepted,
  NonAcademicPositionSchema,
  type NonAcademicStaff,
  NonAcademicStaffSchema,
  normalizeKnownSocialUrl,
  PersonSchema,
  ScienceAcademicDepartments,
  ScienceAcademicSubjects,
  ScienceAcademicUnits,
  type Student,
  StudentLevelSchema,
  StudentSchema,
  StudentStatusSchema,
  StudentTrackSchema,
  StudentTypeSchema,
} from '@scs/schemas';
import { Badge } from '@scs/ui/components/badge';
import { Button } from '@scs/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import { Input } from '@scs/ui/components/input';
import { Label } from '@scs/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@scs/ui/components/select';
import { cn } from 'cn';
import { ExternalLink, Plus, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { z } from 'zod';

import {
  createEditorState,
  type EditorRecordStatus,
  type EditorState,
  updateEditorDraft,
} from '@/components/editor/editor-state';
import { EditorWorkspace } from '@/components/editor/editor-workspace';
import { PageLoading } from '@/components/feedback/page-loading';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { BackButton } from '@/components/navigation/back-button';
import type {
  PostgraduateProgramme,
  ProfileKind,
  ProfileRecord,
  ProfileSchemaResponse,
  PublicProfileInitialData,
  PublicProfilePr,
  PublicProfileResponse,
  StudentPlacementResponse,
} from '@/components/profiles/profile-types';
import { PublicProfileReview } from '@/components/profiles/public-profile-review';
import { ProfileAboutSection } from '@/components/profiles/sections/profile-about-section';
import { ProfileLinksSection } from '@/components/profiles/sections/profile-links-section';
import { ProfileRoleSection } from '@/components/profiles/sections/profile-role-section';
import { ProfileWorkSection } from '@/components/profiles/sections/profile-work-section';
import {
  adminPublicProfileApiUrl,
  adminPublicProfilePrApiUrl,
  adminPublicProfileSchemaApiUrl,
  adminPublicProfileStudentPlacementApiUrl,
  apiHeaders,
  publicProfileApiUrl,
  publicProfilePrApiUrl,
  publicProfileSchemaApiUrl,
  publicProfileStudentPlacementApiUrl,
  readApiError,
} from '@/lib/api';
import {
  profileToolBackRoute,
  type ProfileToolSource,
} from '@/lib/back-routes';
import {
  assertMutationSucceeded,
  isOperationPollingAbort,
  waitForMutationOperation,
} from '@/lib/mutation-operation';
import { useOperationPollingSignal } from '@/lib/use-operation-polling';

type ProfileByKind = {
  academic: AcademicTeachingStaff;
  'academic-support': AcademicSupportStaff;
  'non-academic': NonAcademicStaff;
  student: Student;
};

type ProfileSchemaMap = {
  [Kind in ProfileKind]: z.ZodType<ProfileByKind[Kind]>;
};

function normalizePublicProfileResponse(value: unknown): PublicProfileResponse {
  if (isRecord(value) && 'profile' in value) {
    return value as unknown as PublicProfileResponse;
  }

  return {
    profile: isRecord(value) ? value : null,
  };
}

const PROFILE_LABELS: Record<ProfileKind, string> = {
  academic: 'Academic',
  'academic-support': 'Academic Support',
  'non-academic': 'Non-Academic',
  student: 'Student',
};

const PROFILE_EDITOR_SECTIONS = [
  { id: 'profile-about', label: 'About you' },
  { id: 'profile-role', label: 'Role and affiliation' },
  { id: 'profile-work', label: 'Work and studies' },
  { id: 'profile-links', label: 'Links' },
] as const;

const TITLES = PersonSchema.shape.title.options;
const STUDENT_TYPES = StudentTypeSchema.options;
const STUDENT_TRACKS = StudentTrackSchema.options;
const STUDENT_LEVELS = StudentLevelSchema.options;
const GENERAL_STUDENT_LEVELS = STUDENT_LEVELS.filter(
  (level) => level !== '4000'
);
const STUDENT_STATUSES = StudentStatusSchema.options;
const POSTGRADUATE_PROGRAMMES: PostgraduateProgramme[] = [
  'POSTGRADUATE_CERTIFICATE',
  'POSTGRADUATE_DIPLOMA',
  'MASTERS_COURSEWORK',
  'MSC',
  'MPHIL',
  'MPHIL_UPGRADE_FROM_MSC',
  'PHD',
  'PHD_UPGRADE_FROM_MSC',
  'PHD_UPGRADE_FROM_MPHIL',
];
const POSTGRADUATE_PROGRAMME_LABELS: Record<PostgraduateProgramme, string> = {
  POSTGRADUATE_CERTIFICATE: 'Postgraduate Certificate',
  POSTGRADUATE_DIPLOMA: 'Postgraduate Diploma',
  MASTERS_COURSEWORK: "Master's Degree (Coursework only)",
  MSC: 'Master of Science (MSc)',
  MPHIL: 'Master of Philosophy (MPhil)',
  MPHIL_UPGRADE_FROM_MSC: 'MPhil (Upgrade from MSc)',
  PHD: 'Doctor of Philosophy (PhD)',
  PHD_UPGRADE_FROM_MSC: 'PhD (Upgrade from MSc)',
  PHD_UPGRADE_FROM_MPHIL: 'PhD (Upgrade from MPhil)',
};
const ACADEMIC_RANKS = AcademicRankSchema.options;
const ACADEMIC_SUPPORT_POSITIONS = AcademicSupportPositionSchema.options;
const NON_ACADEMIC_POSITIONS = NonAcademicPositionSchema.options;
const ACADEMIC_DEPARTMENTS = AcademicDepartmentCodeSchema.options;
const ACADEMIC_UNITS = AcademicUnitCodeSchema.options;
const HONOURS_PROGRAMMES = HonoursProgrammeCodeSchema.options;
const ACADEMIC_SUBJECTS = AcademicSubjectCodeSchema.options;
const ACADEMIC_DEPARTMENT_LABELS = Object.fromEntries(
  ScienceAcademicDepartments.map((department) => [
    department.code,
    department.name,
  ])
) as Record<(typeof ACADEMIC_DEPARTMENTS)[number], string>;
const ACADEMIC_UNIT_LABELS = Object.fromEntries(
  ScienceAcademicUnits.map((unit) => [unit.code, unit.name])
) as Record<(typeof ACADEMIC_UNITS)[number], string>;
const HONOURS_PROGRAMME_LABELS = Object.fromEntries(
  ScienceAcademicDepartments.flatMap((department) =>
    department.honoursProgrammes.map((programme) => [
      programme,
      enumLabel(programme),
    ])
  )
) as Record<(typeof HONOURS_PROGRAMMES)[number], string>;
const ACADEMIC_SUBJECT_LABELS = Object.fromEntries(
  ScienceAcademicSubjects.map((subject) => [subject.code, subject.name])
) as Record<(typeof ACADEMIC_SUBJECTS)[number], string>;

const PROFILE_SCHEMAS = {
  academic: AcademicTeachingStaffSchema,
  'academic-support': AcademicSupportStaffSchema,
  'non-academic': NonAcademicStaffSchema,
  student: StudentSchema,
} satisfies ProfileSchemaMap;

const SOCIAL_FIELDS = [
  ['linkedin', 'LinkedIn'],
  ['github', 'GitHub'],
  ['mastodon', 'Mastodon'],
  ['bluesky', 'Bluesky'],
  ['x', 'X'],
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['youtube', 'YouTube'],
] as const satisfies ReadonlyArray<readonly [KnownSocialPlatform, string]>;

const SOCIAL_PLACEHOLDERS: Record<(typeof SOCIAL_FIELDS)[number][0], string> = {
  linkedin: 'username or linkedin.com/in/username',
  github: 'username or github.com/username',
  mastodon: '@username@mastodon.social',
  bluesky: 'username.bsky.social or bsky.app/profile/...',
  x: '@username or x.com/username',
  facebook: 'username or facebook.com/username',
  instagram: '@username or instagram.com/username',
  youtube: '@username or youtube.com/@username',
};

const KNOWN_SOCIAL_EXAMPLES: Record<KnownSocialPlatform, string> = {
  linkedin: 'username or linkedin.com/in/username',
  github: 'username or github.com/username',
  mastodon: '@username@mastodon.social',
  bluesky: 'username.bsky.social or any /profile/ URL',
  x: '@username, x.com/username, or twitter.com/username',
  facebook: 'username or facebook.com/username',
  instagram: '@username or instagram.com/username',
  youtube: '@username or youtube.com/@username',
};

function studentLevelsForTrack(track: unknown) {
  return track === 'GENERAL' ? GENERAL_STUDENT_LEVELS : STUDENT_LEVELS;
}

function studentLevelForTrack(track: unknown, level: unknown) {
  return track === 'GENERAL' && level === '4000' ? '3000' : level;
}

const ICON_LIBRARY_OPTIONS = [
  {
    label: 'ResearchGate',
    provider: 'simple-icons',
    slug: 'researchgate',
  },
  {
    label: 'ORCID',
    provider: 'font-awesome',
    name: 'orcid',
  },
  {
    label: 'Google Scholar',
    provider: 'simple-icons',
    slug: 'googlescholar',
  },
  {
    label: 'Medium',
    provider: 'font-awesome',
    name: 'medium',
  },
] as const;

function enumLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function emptyProfile(kind: ProfileKind): ProfileRecord {
  if (kind === 'student') {
    return {
      title: 'Mr',
      fullName: '',
      registrationNo: '',
      studentType: 'UNDERGRADUATE',
      studentTrack: 'GENERAL',
      level: '1000',
      status: 'CURRENT',
    };
  }

  if (kind === 'academic') {
    return {
      title: 'Dr',
      fullName: '',
      email: '',
      staffType: 'ACADEMIC_TEACHING',
      academicRank: 'LECTURER',
    };
  }

  if (kind === 'academic-support') {
    return {
      title: 'Mr',
      fullName: '',
      email: '',
      staffType: 'ACADEMIC_SUPPORT',
      designation: 'PROGRAMMER',
    };
  }

  return {
    title: 'Mr',
    fullName: '',
    email: '',
    staffType: 'NON_ACADEMIC',
    designation: 'STAFF_ASSISTANT',
  };
}

function inferProfileKind(
  profile: ProfileRecord | null,
  fallback: ProfileKind
) {
  if (!profile) return fallback;
  if (profile.staffType === 'ACADEMIC_TEACHING') return 'academic';
  if (profile.staffType === 'ACADEMIC_SUPPORT') return 'academic-support';
  if (profile.staffType === 'NON_ACADEMIC') return 'non-academic';
  if (profile.registrationNo) return 'student';
  return fallback;
}

function defaultKindForEmptyProfile(allowedKinds: ProfileKind[]) {
  return allowedKinds.includes('student')
    ? 'student'
    : (allowedKinds[0] ?? 'student');
}

function statusBadgeClass(status: PublicProfilePr['status']) {
  if (status === 'open') {
    return 'border-success-border bg-success-surface text-success-surface-foreground';
  }

  if (status === 'none') {
    return 'border-border bg-muted text-muted-foreground';
  }

  if (status === 'auto_merge_queued' || status === 'checks_pending') {
    return 'border-warning-border bg-warning-surface text-warning-surface-foreground';
  }

  if (status === 'checks_failed' || status === 'closed') {
    return 'border-destructive-border bg-destructive-surface text-destructive-surface-foreground';
  }

  if (status === 'merged') {
    return 'border-info-border bg-info-surface text-info-surface-foreground';
  }

  return 'border-border bg-muted text-muted-foreground   ';
}

function statusButtonClass(status: PublicProfilePr['status']) {
  if (status === 'open') {
    return 'border-success-border bg-success-surface text-success-surface-foreground hover:bg-success-surface/80';
  }

  if (status === 'auto_merge_queued' || status === 'checks_pending') {
    return 'border-warning-border bg-warning-surface text-warning-surface-foreground hover:bg-warning-surface/80';
  }

  if (status === 'checks_failed' || status === 'closed') {
    return 'border-destructive-border bg-destructive-surface text-destructive-surface-foreground hover:bg-destructive-surface/80';
  }

  if (status === 'merged') {
    return 'border-info-border bg-info-surface text-info-surface-foreground hover:bg-info-surface/80';
  }

  return '';
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function asArray<T extends ProfileRecord>(value: unknown): T[] {
  return Array.isArray(value) ? (value.filter(isRecord) as T[]) : [];
}

function isRecord(value: unknown): value is ProfileRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pruneEmpty(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    const items = value.map(pruneEmpty).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }

  if (isRecord(value)) {
    const entries = Object.entries(value)
      .map(([key, entry]) => [key, pruneEmpty(entry)] as const)
      .filter(([, entry]) => entry !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }

  return value;
}

function applyKindDefaults(kind: ProfileKind, current: ProfileRecord) {
  const common = {
    title: current.title ?? emptyProfile(kind).title,
    fullName: current.fullName ?? '',
    email: current.email ?? '',
    profileImageUrl: current.profileImageUrl ?? '',
    mobilePhone: current.mobilePhone ?? '',
  };

  return {
    ...emptyProfile(kind),
    ...common,
  };
}

function normalizeStudentProfileFields(
  profileKind: ProfileKind,
  profile: ProfileRecord
) {
  if (profileKind !== 'student') return profile;

  const nextProfile = { ...profile };
  if (
    !STUDENT_TYPES.includes(nextProfile.studentType as Student['studentType'])
  ) {
    nextProfile.studentType = 'UNDERGRADUATE';
  }
  if (!STUDENT_STATUSES.includes(nextProfile.status as Student['status'])) {
    nextProfile.status = 'CURRENT';
  }
  if (
    nextProfile.studentTrack !== undefined &&
    !STUDENT_TRACKS.includes(
      nextProfile.studentTrack as NonNullable<Student['studentTrack']>
    )
  ) {
    nextProfile.studentTrack = undefined;
  }
  if (
    nextProfile.level !== undefined &&
    !STUDENT_LEVELS.includes(nextProfile.level as NonNullable<Student['level']>)
  ) {
    nextProfile.level = undefined;
  }
  if (
    nextProfile.studentType !== 'POSTGRADUATE' &&
    nextProfile.level !== undefined
  ) {
    nextProfile.level = studentLevelForTrack(
      nextProfile.studentTrack ?? 'GENERAL',
      nextProfile.level
    );
  }
  if (
    nextProfile.postgraduateProgramme !== undefined &&
    !POSTGRADUATE_PROGRAMMES.includes(
      nextProfile.postgraduateProgramme as PostgraduateProgramme
    )
  ) {
    nextProfile.postgraduateProgramme = undefined;
  }
  if (
    nextProfile.studentType !== 'UNDERGRADUATE' ||
    nextProfile.studentTrack !== 'HONOURS'
  ) {
    nextProfile.honoursProgramme = undefined;
  }

  return nextProfile;
}

function trustedProfileForSchema(input: {
  profileKind: ProfileKind;
  profile: ProfileRecord;
  identity?: ProfileSchemaResponse['identity'];
  lockedFields: string[];
}) {
  const nextProfile = normalizeStudentProfileFields(
    input.profileKind,
    input.profile
  );
  const locked = new Set(input.lockedFields);

  if (locked.has('email') && input.identity?.email) {
    nextProfile.email = input.identity.email;
  }

  if (locked.has('registrationNo') && input.identity?.username) {
    nextProfile.registrationNo = input.identity.username.toUpperCase();
  }

  if (locked.has('level') && input.identity?.studentPlacement?.level) {
    nextProfile.level = input.identity.studentPlacement.level;
  }

  if (locked.has('status') && input.identity?.studentPlacement?.status) {
    nextProfile.status = input.identity.studentPlacement.status;
  }

  if (locked.has('slqfLevel') && input.identity?.studentPlacement?.slqfLevel) {
    nextProfile.slqfLevel = input.identity.studentPlacement.slqfLevel;
  }

  if (locked.has('staffType')) {
    if (input.profileKind === 'academic') {
      nextProfile.staffType = 'ACADEMIC_TEACHING';
    } else if (input.profileKind === 'academic-support') {
      nextProfile.staffType = 'ACADEMIC_SUPPORT';
    } else if (input.profileKind === 'non-academic') {
      nextProfile.staffType = 'NON_ACADEMIC';
    }
  }

  return nextProfile;
}

function schemaForKind(kind: ProfileKind) {
  return PROFILE_SCHEMAS[kind];
}

function validationMessage(error: {
  issues: { path: PropertyKey[]; message: string }[];
}) {
  return error.issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');
}

function profileIssueField(path: PropertyKey[]) {
  const root = String(path[0] ?? 'profile');
  if (root === 'socialLinks') return 'profile-links';
  if (
    [
      'publications',
      'projects',
      'qualifications',
      'researchInterests',
      'teachings',
    ].includes(root)
  ) {
    return 'profile-work';
  }
  if (
    [
      'title',
      'fullName',
      'email',
      'personalEmail',
      'profileImageUrl',
      'mobilePhone',
    ].includes(root)
  ) {
    return 'profile-about';
  }
  return 'profile-role';
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  description?: string;
  error?: string;
  onBlur?: () => void;
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = 'text',
  disabled,
  description,
  error,
  onBlur,
}: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={!!error}
      />
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      {description && !error ? (
        <p className="text-muted-foreground text-xs">{description}</p>
      ) : null}
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  description?: string;
}

function SelectField({
  label,
  value,
  options,
  onChange,
  description,
}: SelectFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description ? (
        <p className="text-muted-foreground text-xs">{description}</p>
      ) : null}
    </div>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
}: TextAreaFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <textarea
        className="border-input bg-background focus-visible:border-ring
          focus-visible:ring-ring/50 min-h-24 w-full rounded-md border px-3 py-2
          text-sm shadow-xs transition-[color,box-shadow] outline-none
          focus-visible:ring-[3px]"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

interface OptionGridProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  required?: boolean;
  compact?: boolean;
  labels?: Record<string, string>;
  disabled?: boolean;
}

function OptionGrid({
  label,
  value,
  options,
  onChange,
  required,
  compact,
  labels,
  disabled,
}: OptionGridProps) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <div
        className={cn(
          'grid gap-2',
          compact
            ? 'grid-cols-2 sm:grid-cols-4'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        )}
      >
        {options.map((option) => (
          <Button
            key={option}
            type="button"
            variant={value === option ? 'default' : 'outline'}
            className="h-auto min-h-9 justify-start px-3 py-2 text-left
              whitespace-normal"
            disabled={disabled}
            onClick={() => onChange(option)}
          >
            {labels?.[option] ?? enumLabel(option)}
          </Button>
        ))}
      </div>
    </div>
  );
}

interface ArrayEditorProps {
  label: string;
  value: ProfileRecord[];
  emptyItem: ProfileRecord;
  onChange: (value: ProfileRecord[]) => void;
  renderItem: (
    item: ProfileRecord,
    update: (key: string, value: unknown) => void,
    index: number
  ) => React.ReactNode;
}

function ArrayEditor({
  label,
  value,
  emptyItem,
  onChange,
  renderItem,
}: ArrayEditorProps) {
  function updateItem(index: number, key: string, itemValue: unknown) {
    onChange(
      value.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: itemValue } : item
      )
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, { ...emptyItem }])}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      {value.length ? (
        <div className="space-y-3">
          {value.map((item, index) => (
            <div key={index} className="bg-muted/20 rounded-md border p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <Badge variant="outline">#{index + 1}</Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    onChange(
                      value.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                  aria-label={`Remove ${label} item ${index + 1}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {renderItem(
                  item,
                  (key, itemValue) => updateItem(index, key, itemValue),
                  index
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No entries</p>
      )}
    </div>
  );
}

interface StringArrayEditorProps {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  options?: string[];
  labels?: Record<string, string>;
}

function StringArrayEditor({
  label,
  value,
  onChange,
  placeholder,
  options,
  labels,
}: StringArrayEditorProps) {
  function updateItem(index: number, itemValue: string) {
    onChange(
      value.map((item, itemIndex) => (itemIndex === index ? itemValue : item))
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, ''])}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      {value.length ? (
        <div className="space-y-2">
          {value.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-[1fr_auto] items-center gap-2"
            >
              {options ? (
                <Select
                  value={item}
                  onValueChange={(nextValue) => updateItem(index, nextValue)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {labels?.[option] ?? option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={item}
                  onChange={(event) => updateItem(index, event.target.value)}
                  placeholder={placeholder}
                />
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() =>
                  onChange(value.filter((_, itemIndex) => itemIndex !== index))
                }
                aria-label={`Remove ${label} item ${index + 1}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No entries</p>
      )}
    </div>
  );
}

interface SocialLinksEditorProps {
  value: unknown;
  onChange: (value: unknown) => void;
}

function SocialLinksEditor({ value, onChange }: SocialLinksEditorProps) {
  const links = isRecord(value) ? value : {};
  const urls = isRecord(links.urls) ? links.urls : {};
  const otherPlatforms = asArray(links.otherPlatforms);

  function setUsername(key: string, fieldValue: string) {
    const nextUrls = { ...urls, [key]: fieldValue };
    const nextLinks: Record<string, unknown> = { ...links, urls: nextUrls };
    onChange(nextLinks);
  }

  function normalizeUsername(key: (typeof SOCIAL_FIELDS)[number][0]) {
    const currentValue = asString(urls[key]);
    if (!currentValue.trim()) return;

    const normalized = normalizeKnownSocialUrl(key, currentValue);
    if (normalized) setUsername(key, normalized);
  }

  function setOtherPlatforms(value: ProfileRecord[]) {
    onChange({
      ...links,
      otherPlatforms: value,
    });
  }

  function promoteKnownOtherPlatform(index: number) {
    const item = otherPlatforms[index];
    const known = detectKnownSocialUrl(asString(item?.url));
    if (!known) return;

    onChange({
      ...links,
      urls: {
        ...urls,
        [known.platform]: known.url,
      },
      otherPlatforms: otherPlatforms.filter(
        (_, itemIndex) => itemIndex !== index
      ),
    });
  }

  return (
    <div className="space-y-6">
      <Label>Social Links</Label>
      <div className="grid gap-3 md:grid-cols-2">
        {SOCIAL_FIELDS.map(([key, label]) => (
          <Field
            key={key}
            label={label}
            value={asString(urls[key])}
            onChange={(fieldValue) => setUsername(key, fieldValue)}
            onBlur={() => normalizeUsername(key)}
            placeholder={SOCIAL_PLACEHOLDERS[key]}
            description={`Example: ${KNOWN_SOCIAL_EXAMPLES[key]}`}
            error={
              asString(urls[key]).trim() &&
              !normalizeKnownSocialUrl(key, asString(urls[key]))
                ? `Use a valid ${label} username or profile URL.`
                : undefined
            }
          />
        ))}
      </div>
      <ArrayEditor
        label="Other Platforms"
        value={otherPlatforms}
        emptyItem={{
          platformName: '',
          url: '',
          icon: {
            type: 'simple-icons',
            slug: 'researchgate',
          },
        }}
        onChange={setOtherPlatforms}
        renderItem={(item, update, index) => (
          <>
            <Field
              label="Platform Name"
              value={asString(item.platformName)}
              onChange={(fieldValue) => update('platformName', fieldValue)}
              required
            />
            <Field
              label="URL"
              value={asString(item.url)}
              onChange={(fieldValue) => update('url', fieldValue)}
              type="url"
              required
              placeholder="https://example.com"
              description="Known socials move into the locked section automatically."
              onBlur={() => promoteKnownOtherPlatform(index)}
            />
            <OtherPlatformIconEditor item={item} update={update} />
          </>
        )}
      />
    </div>
  );
}

interface OtherPlatformIconEditorProps {
  item: ProfileRecord;
  update: (key: string, value: unknown) => void;
}

function OtherPlatformIconEditor({
  item,
  update,
}: OtherPlatformIconEditorProps) {
  const icon = isRecord(item.icon)
    ? item.icon
    : { type: 'simple-icons', slug: 'researchgate' };
  const iconType = asString(icon.type);
  const libraryValue =
    iconType === 'font-awesome'
      ? `font-awesome:${asString(icon.name)}`
      : `simple-icons:${asString(icon.slug)}`;

  function setLibraryIcon(value: string) {
    const [type, name] = value.split(':');
    if (type === 'font-awesome') {
      update('icon', {
        type: 'font-awesome',
        style: 'brands',
        name,
      });
      return;
    }

    update('icon', {
      type: 'simple-icons',
      slug: name,
    });
  }

  return (
    <>
      <SelectField
        label="Icon Source"
        value={iconType === 'url' ? 'url' : 'library'}
        options={[
          { value: 'library', label: 'Icon library' },
          { value: 'url', label: 'Manual icon URL' },
        ]}
        onChange={(value) =>
          value === 'url'
            ? update('icon', {
                type: 'url',
                url: '',
              })
            : update('icon', {
                type: 'simple-icons',
                slug: 'researchgate',
              })
        }
      />
      {iconType === 'url' ? (
        <Field
          label="Manual Icon URL"
          value={asString(icon.url)}
          onChange={(fieldValue) =>
            update('icon', {
              type: 'url',
              url: fieldValue,
            })
          }
          type="url"
          placeholder="https://example.com/icon.svg"
        />
      ) : (
        <SelectField
          label="Library Icon"
          value={libraryValue}
          options={ICON_LIBRARY_OPTIONS.map((option) => ({
            value:
              option.provider === 'font-awesome'
                ? `font-awesome:${option.name}`
                : `simple-icons:${option.slug}`,
            label:
              option.provider === 'font-awesome'
                ? `Font Awesome Brands - ${option.label}`
                : `Simple Icons - ${option.label}`,
          }))}
          onChange={setLibraryIcon}
          description="Known social platforms use locked automatic icons."
        />
      )}
    </>
  );
}

interface FormProps {
  profileKind: ProfileKind;
  profile: ProfileRecord;
  identity?: ProfileSchemaResponse['identity'];
  lockedFields: string[];
  onProfileChange: (profile: ProfileRecord) => void;
}

function ProfileForm({
  profileKind,
  profile,
  identity,
  lockedFields,
  onProfileChange,
}: FormProps) {
  function setField(key: string, value: unknown) {
    onProfileChange({ ...profile, [key]: value });
  }

  function setArrayField(key: string, value: ProfileRecord[]) {
    onProfileChange({ ...profile, [key]: value });
  }

  const isStudent = profileKind === 'student';
  const isStaff = !isStudent;
  const studentType = asString(profile.studentType) || 'UNDERGRADUATE';
  const isPostgraduate = isStudent && studentType === 'POSTGRADUATE';
  const isHonoursStudent =
    isStudent &&
    !isPostgraduate &&
    asString(profile.studentTrack) === 'HONOURS';
  const honoursProgramme = HONOURS_PROGRAMMES.includes(
    profile.honoursProgramme as (typeof HONOURS_PROGRAMMES)[number]
  )
    ? (profile.honoursProgramme as (typeof HONOURS_PROGRAMMES)[number])
    : undefined;
  const honoursDepartment = honoursProgramme
    ? HonoursProgrammeDepartmentMap[honoursProgramme]
    : undefined;
  const undergraduateTrack = asString(profile.studentTrack) || 'GENERAL';
  const undergraduateLevelOptions = studentLevelsForTrack(undergraduateTrack);
  const undergraduateLevel = studentLevelForTrack(
    undergraduateTrack,
    asString(profile.level)
  );
  const locked = new Set(lockedFields);
  const lockedEmail = locked.has('email');
  const lockedRegistrationNo = locked.has('registrationNo');
  const lockedLevel = locked.has('level');
  const lockedStatus = locked.has('status');
  const lockedSlqfLevel = locked.has('slqfLevel');
  const displayEmail = lockedEmail
    ? (identity?.email ?? asString(profile.email))
    : asString(profile.email);
  const displayRegistrationNo =
    lockedRegistrationNo &&
    identity?.username &&
    /^s\d{2}(sp)?\d{3}$/i.test(identity.username)
      ? identity.username.toUpperCase()
      : asString(profile.registrationNo);

  return (
    <div className="space-y-8">
      {lockedFields.length > 0 ? (
        <p
          className="bg-muted/35 text-muted-foreground rounded-md border p-3
            text-sm"
        >
          <span className="text-foreground font-medium">
            Managed by university records.
          </span>{' '}
          Disabled fields come from the official record. Ask an administrator if
          a value is incorrect.
        </p>
      ) : null}

      <ProfileAboutSection>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <OptionGrid
              label="Title"
              value={asString(profile.title)}
              options={TITLES}
              onChange={(value) => setField('title', value)}
              required
              compact
              labels={Object.fromEntries(TITLES.map((title) => [title, title]))}
            />
          </div>
          <Field
            label="Full Name"
            value={asString(profile.fullName)}
            onChange={(value) => setField('fullName', value)}
            required
          />
          <Field
            label={isStaff ? 'University Email' : 'Email'}
            value={displayEmail}
            onChange={(value) => setField('email', value)}
            required={isStaff}
            type="email"
            placeholder="name@pdn.ac.lk"
            disabled={lockedEmail}
          />
          <Field
            label="Profile Image URL"
            value={asString(profile.profileImageUrl)}
            onChange={(value) => setField('profileImageUrl', value)}
            type="url"
            placeholder="https://example.com/profile.jpg"
          />
          <Field
            label="Mobile Phone"
            value={asString(profile.mobilePhone)}
            onChange={(value) => setField('mobilePhone', value)}
            placeholder="+94 7X XXX XXXX"
          />
        </div>
      </ProfileAboutSection>

      <ProfileRoleSection>
        {isStudent ? (
          <section className="space-y-4">
            <h3 className="text-base font-semibold">Student Details</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Registration No"
                value={displayRegistrationNo}
                onChange={(value) => setField('registrationNo', value)}
                required
                placeholder="S20XXX or S20SPXXX"
                disabled={lockedRegistrationNo}
              />
              <Field
                label="Personal Email"
                value={asString(profile.personalEmail)}
                onChange={(value) => setField('personalEmail', value)}
                type="email"
                placeholder="name@example.com"
              />
            </div>
            <OptionGrid
              label="Student Type"
              value={studentType}
              options={STUDENT_TYPES}
              onChange={(value) => setField('studentType', value)}
              required
              compact
              labels={{
                UNDERGRADUATE: 'Undergraduate',
                POSTGRADUATE: 'Postgraduate',
              }}
            />
            {!isPostgraduate ? (
              <OptionGrid
                label="Track"
                value={undergraduateTrack}
                options={[...STUDENT_TRACKS]}
                onChange={(value) =>
                  onProfileChange({
                    ...profile,
                    studentTrack: value,
                    level: studentLevelForTrack(value, profile.level),
                    honoursProgramme:
                      value === 'HONOURS'
                        ? profile.honoursProgramme
                        : undefined,
                  })
                }
                required
                compact
                labels={{
                  GENERAL: 'General',
                  HONOURS: 'Honours',
                }}
              />
            ) : null}
            {!isPostgraduate ? (
              <>
                <OptionGrid
                  label="Level"
                  value={asString(undergraduateLevel)}
                  options={undergraduateLevelOptions}
                  onChange={(value) => setField('level', value)}
                  required
                  compact
                  disabled={lockedLevel}
                  labels={{
                    '1000': '1000 Level',
                    '2000': '2000 Level',
                    '3000': '3000 Level',
                    '4000': '4000 Level',
                  }}
                />
                {isHonoursStudent ? (
                  <>
                    <SelectField
                      label="Honours Programme"
                      value={asString(profile.honoursProgramme)}
                      options={HONOURS_PROGRAMMES.map((programme) => ({
                        value: programme,
                        label: HONOURS_PROGRAMME_LABELS[programme],
                      }))}
                      onChange={(value) => setField('honoursProgramme', value)}
                      description="Required. Your department and any eligible public directory are assigned automatically from this programme."
                    />
                    {honoursDepartment ? (
                      <p
                        className="bg-muted/35 text-muted-foreground rounded-md
                          border p-3 text-sm"
                      >
                        Department:{' '}
                        {ACADEMIC_DEPARTMENT_LABELS[honoursDepartment]}
                      </p>
                    ) : null}
                  </>
                ) : null}
                <StringArrayEditor
                  label="Subjects"
                  value={
                    Array.isArray(profile.subjects)
                      ? profile.subjects.filter(
                          (item): item is string => typeof item === 'string'
                        )
                      : []
                  }
                  onChange={(value) => setField('subjects', value)}
                  options={ACADEMIC_SUBJECTS}
                  labels={ACADEMIC_SUBJECT_LABELS}
                  placeholder="Special subject"
                />
              </>
            ) : (
              <>
                <SelectField
                  label="Programme"
                  value={
                    POSTGRADUATE_PROGRAMMES.includes(
                      profile.postgraduateProgramme as PostgraduateProgramme
                    )
                      ? (profile.postgraduateProgramme as PostgraduateProgramme)
                      : 'MSC'
                  }
                  options={POSTGRADUATE_PROGRAMMES.map((programme) => ({
                    value: programme,
                    label: POSTGRADUATE_PROGRAMME_LABELS[programme],
                  }))}
                  onChange={(value) => setField('postgraduateProgramme', value)}
                />
                <OptionGrid
                  label="SLQF Level"
                  value={asString(profile.slqfLevel)}
                  options={['L7', 'L8', 'L9', 'L10', 'L11', 'L12']}
                  onChange={(value) => setField('slqfLevel', value)}
                  required
                  compact
                  disabled={lockedSlqfLevel}
                  labels={{
                    L7: 'L7',
                    L8: 'L8',
                    L9: 'L9',
                    L10: 'L10',
                    L11: 'L11',
                    L12: 'L12',
                  }}
                />
              </>
            )}
            <OptionGrid
              label="Status"
              value={asString(profile.status)}
              options={STUDENT_STATUSES}
              onChange={(value) => setField('status', value)}
              required
              compact
              disabled={lockedStatus}
              labels={{
                CURRENT: 'Current',
                ALUMNI: 'Alumni',
              }}
            />
            <StringArrayEditor
              label="Primary Research Focus"
              value={
                Array.isArray(profile.researchInterests)
                  ? profile.researchInterests.filter(
                      (item): item is string => typeof item === 'string'
                    )
                  : []
              }
              onChange={(value) => setField('researchInterests', value)}
              placeholder="One focus area per line"
            />
          </section>
        ) : null}

        {profileKind === 'academic' ||
        profileKind === 'academic-support' ||
        profileKind === 'non-academic' ? (
          <section className="space-y-4">
            <h3 className="text-base font-semibold">Department & Unit</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Department"
                value={asString(profile.department)}
                options={ACADEMIC_DEPARTMENTS.map((department) => ({
                  value: department,
                  label: ACADEMIC_DEPARTMENT_LABELS[department],
                }))}
                onChange={(value) => setField('department', value)}
                description="Academic department this person belongs to."
              />
              <SelectField
                label="Unit"
                value={asString(profile.unit)}
                options={ACADEMIC_UNITS.map((unit) => ({
                  value: unit,
                  label: ACADEMIC_UNIT_LABELS[unit],
                }))}
                onChange={(value) => setField('unit', value)}
                description="Service unit this person belongs to, if any."
              />
            </div>
          </section>
        ) : null}

        {profileKind === 'academic' ? (
          <section className="space-y-4">
            <h3 className="text-base font-semibold">Academic Details</h3>
            <OptionGrid
              label="Academic Rank"
              value={asString(profile.academicRank)}
              options={ACADEMIC_RANKS}
              onChange={(value) => setField('academicRank', value)}
              required
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Office Phone"
                value={asString(profile.officePhone)}
                onChange={(value) => setField('officePhone', value)}
                placeholder="+94 81 239 XXXX"
              />
              <Field
                label="Office Location"
                value={asString(profile.officeLocation)}
                onChange={(value) => setField('officeLocation', value)}
                placeholder="Room 101, SCS Building"
              />
              <Field
                label="Website"
                value={asString(profile.website)}
                onChange={(value) => setField('website', value)}
                type="url"
                placeholder="https://example.com"
              />
              <Field
                label="CV URL"
                value={asString(profile.cvUrl)}
                onChange={(value) => setField('cvUrl', value)}
                type="url"
                placeholder="https://example.com/cv.pdf"
              />
            </div>
            <StringArrayEditor
              label="Teaching Areas"
              value={
                Array.isArray(profile.teachings)
                  ? profile.teachings.filter(
                      (item): item is string => typeof item === 'string'
                    )
                  : []
              }
              onChange={(value) => setField('teachings', value)}
              placeholder="CSC3213"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <StringArrayEditor
                label="Primary Research Focus"
                value={asArray(profile.researchInterests).flatMap((interest) =>
                  Array.isArray(interest.primaryFocus)
                    ? interest.primaryFocus.filter(
                        (item): item is string => typeof item === 'string'
                      )
                    : []
                )}
                onChange={(value) =>
                  setField('researchInterests', [
                    {
                      ...asArray(profile.researchInterests)[0],
                      primaryFocus: value,
                    },
                  ])
                }
                placeholder="Research focus"
              />
              <StringArrayEditor
                label="Other Research Interests"
                value={asArray(profile.researchInterests).flatMap((interest) =>
                  Array.isArray(interest.otherInterests)
                    ? interest.otherInterests.filter(
                        (item): item is string => typeof item === 'string'
                      )
                    : []
                )}
                onChange={(value) =>
                  setField('researchInterests', [
                    {
                      ...asArray(profile.researchInterests)[0],
                      otherInterests: value,
                    },
                  ])
                }
                placeholder="Research interest"
              />
            </div>
          </section>
        ) : null}

        {profileKind === 'academic-support' ? (
          <section className="space-y-4">
            <h3 className="text-base font-semibold">
              Academic Support Details
            </h3>
            <OptionGrid
              label="Designation"
              value={asString(profile.designation)}
              options={ACADEMIC_SUPPORT_POSITIONS}
              onChange={(value) => setField('designation', value)}
              required
            />
            <Field
              label="Office Phone"
              value={asString(profile.officePhone)}
              onChange={(value) => setField('officePhone', value)}
              placeholder="+94 81 239 XXXX"
            />
            <StringArrayEditor
              label="Qualifications"
              value={
                Array.isArray(profile.qualifications)
                  ? profile.qualifications.filter(
                      (item): item is string => typeof item === 'string'
                    )
                  : []
              }
              onChange={(value) => setField('qualifications', value)}
              placeholder="Qualification"
            />
          </section>
        ) : null}

        {profileKind === 'non-academic' ? (
          <section className="space-y-4">
            <h3 className="text-base font-semibold">Non-Academic Details</h3>
            <OptionGrid
              label="Designation"
              value={asString(profile.designation)}
              options={NON_ACADEMIC_POSITIONS}
              onChange={(value) => setField('designation', value)}
              required
            />
            <Field
              label="Office Phone"
              value={asString(profile.officePhone)}
              onChange={(value) => setField('officePhone', value)}
              placeholder="+94 81 239 XXXX"
            />
          </section>
        ) : null}
      </ProfileRoleSection>

      <ProfileWorkSection>
        {isStudent || profileKind === 'academic' ? (
          <CommonProfileCollections
            profile={profile}
            setArrayField={setArrayField}
            includeAcademicExtra={profileKind === 'academic'}
          />
        ) : (
          <p className="text-muted-foreground rounded-md border p-3 text-sm">
            This profile type has no additional public work collections.
          </p>
        )}
      </ProfileWorkSection>

      <ProfileLinksSection>
        <SocialLinksEditor
          value={profile.socialLinks}
          onChange={(value) => setField('socialLinks', value)}
        />
      </ProfileLinksSection>
    </div>
  );
}

interface CollectionsProps {
  profile: ProfileRecord;
  setArrayField: (key: string, value: ProfileRecord[]) => void;
  includeAcademicExtra: boolean;
}

function CommonProfileCollections({
  profile,
  setArrayField,
  includeAcademicExtra,
}: CollectionsProps) {
  return (
    <div className="space-y-6">
      {includeAcademicExtra ? (
        <ArrayEditor
          label="Qualifications"
          value={asArray(profile.qualifications)}
          emptyItem={{
            degree: '',
            institution: '',
            graduationYear: '',
            description: '',
            icon: '',
          }}
          onChange={(value) => setArrayField('qualifications', value)}
          renderItem={(item, update) => (
            <>
              <Field
                label="Degree"
                value={asString(item.degree)}
                onChange={(value) => update('degree', value)}
                required
              />
              <Field
                label="Institution"
                value={asString(item.institution)}
                onChange={(value) => update('institution', value)}
                required
              />
              <Field
                label="Graduation Year"
                value={asString(item.graduationYear)}
                onChange={(value) => update('graduationYear', value)}
                required
                placeholder="2024"
              />
              <Field
                label="Icon URL"
                value={asString(item.icon)}
                onChange={(value) => update('icon', value)}
                type="url"
                placeholder="https://example.com/icon.svg"
              />
              <div className="md:col-span-2">
                <TextAreaField
                  label="Description"
                  value={asString(item.description)}
                  onChange={(value) => update('description', value)}
                  placeholder="Short optional description"
                />
              </div>
            </>
          )}
        />
      ) : null}

      <ArrayEditor
        label="Positions"
        value={asArray(
          includeAcademicExtra ? profile.positionsHeld : profile.positions
        )}
        emptyItem={{ name: '', startDate: '', endDate: '', icon: '' }}
        onChange={(value) =>
          setArrayField(
            includeAcademicExtra ? 'positionsHeld' : 'positions',
            value
          )
        }
        renderItem={(item, update) => (
          <>
            <Field
              label="Name"
              value={asString(item.name)}
              onChange={(value) => update('name', value)}
              required
            />
            <Field
              label="Start Date"
              value={asString(item.startDate)}
              onChange={(value) => update('startDate', value)}
              required
              placeholder="2024 or 2024-01"
            />
            <Field
              label="End Date"
              value={asString(item.endDate)}
              onChange={(value) => update('endDate', value)}
              placeholder="Present or 2025"
            />
            <Field
              label="Icon URL"
              value={asString(item.icon)}
              onChange={(value) => update('icon', value)}
              type="url"
              placeholder="https://example.com/icon.svg"
            />
          </>
        )}
      />

      {includeAcademicExtra ? (
        <>
          <ArrayEditor
            label="Awards"
            value={asArray(profile.awards)}
            emptyItem={{ name: '', date: '', description: '', icon: '' }}
            onChange={(value) => setArrayField('awards', value)}
            renderItem={(item, update) => (
              <>
                <Field
                  label="Name"
                  value={asString(item.name)}
                  onChange={(value) => update('name', value)}
                  required
                />
                <Field
                  label="Date"
                  value={asString(item.date)}
                  onChange={(value) => update('date', value)}
                  placeholder="2024"
                />
                <Field
                  label="Icon URL"
                  value={asString(item.icon)}
                  onChange={(value) => update('icon', value)}
                  type="url"
                  placeholder="https://example.com/icon.svg"
                />
                <div className="md:col-span-2">
                  <TextAreaField
                    label="Description"
                    value={asString(item.description)}
                    onChange={(value) => update('description', value)}
                    placeholder="Short optional description"
                  />
                </div>
              </>
            )}
          />
          <ArrayEditor
            label="Ongoing Research"
            value={asArray(profile.researchOngoing)}
            emptyItem={{
              title: '',
              startDate: '',
              endDate: '',
              description: '',
              website: '',
              icon: '',
            }}
            onChange={(value) => setArrayField('researchOngoing', value)}
            renderItem={(item, update) => (
              <>
                <Field
                  label="Title"
                  value={asString(item.title)}
                  onChange={(value) => update('title', value)}
                  required
                />
                <Field
                  label="Start Date"
                  value={asString(item.startDate)}
                  onChange={(value) => update('startDate', value)}
                  required
                  placeholder="2024-01"
                />
                <Field
                  label="End Date"
                  value={asString(item.endDate)}
                  onChange={(value) => update('endDate', value)}
                  placeholder="Present or 2025-12"
                />
                <Field
                  label="Website"
                  value={asString(item.website)}
                  onChange={(value) => update('website', value)}
                  type="url"
                  placeholder="https://example.com/project"
                />
                <Field
                  label="Icon URL"
                  value={asString(item.icon)}
                  onChange={(value) => update('icon', value)}
                  type="url"
                  placeholder="https://example.com/icon.svg"
                />
                <div className="md:col-span-2">
                  <TextAreaField
                    label="Description"
                    value={asString(item.description)}
                    onChange={(value) => update('description', value)}
                    placeholder="Short optional description"
                  />
                </div>
              </>
            )}
          />
        </>
      ) : null}

      <PublicationArray
        label="Publications"
        value={asArray(profile.publications)}
        onChange={(value) => setArrayField('publications', value)}
      />

      {includeAcademicExtra ? (
        <>
          <PublicationArray
            label="Key Publications"
            value={asArray(profile.keyPublications)}
            onChange={(value) => setArrayField('keyPublications', value)}
          />
          <ArrayEditor
            label="Conferences Attended"
            value={asArray(profile.conferencesAttended)}
            emptyItem={{
              name: '',
              date: '',
              location: '',
              description: '',
              icon: '',
            }}
            onChange={(value) => setArrayField('conferencesAttended', value)}
            renderItem={(item, update) => (
              <>
                <Field
                  label="Name"
                  value={asString(item.name)}
                  onChange={(value) => update('name', value)}
                  required
                />
                <Field
                  label="Date"
                  value={asString(item.date)}
                  onChange={(value) => update('date', value)}
                  placeholder="2024-07"
                />
                <Field
                  label="Location"
                  value={asString(item.location)}
                  onChange={(value) => update('location', value)}
                  placeholder="Kandy, Sri Lanka"
                />
                <Field
                  label="Icon URL"
                  value={asString(item.icon)}
                  onChange={(value) => update('icon', value)}
                  type="url"
                  placeholder="https://example.com/icon.svg"
                />
                <div className="md:col-span-2">
                  <TextAreaField
                    label="Description"
                    value={asString(item.description)}
                    onChange={(value) => update('description', value)}
                    placeholder="Short optional description"
                  />
                </div>
              </>
            )}
          />
        </>
      ) : null}
    </div>
  );
}

interface PublicationArrayProps {
  label: string;
  value: ProfileRecord[];
  onChange: (value: ProfileRecord[]) => void;
}

function PublicationArray({ label, value, onChange }: PublicationArrayProps) {
  return (
    <ArrayEditor
      label={label}
      value={value}
      emptyItem={{
        title: '',
        journal: '',
        publicationDate: '',
        coAuthors: [],
        description: '',
        doi: {
          doiId: '',
          doiUrl: '',
        },
        url: '',
        icon: '',
      }}
      onChange={onChange}
      renderItem={(item, update) => (
        <>
          <Field
            label="Title"
            value={asString(item.title)}
            onChange={(fieldValue) => update('title', fieldValue)}
            required
          />
          <Field
            label="Journal"
            value={asString(item.journal)}
            onChange={(fieldValue) => update('journal', fieldValue)}
            placeholder="Journal or venue name"
          />
          <Field
            label="Publication Date"
            value={asString(item.publicationDate)}
            onChange={(fieldValue) => update('publicationDate', fieldValue)}
            placeholder="2024 or 2024-07-01"
          />
          <Field
            label="DOI ID"
            value={asString(isRecord(item.doi) ? item.doi.doiId : undefined)}
            onChange={(fieldValue) =>
              update('doi', {
                ...(isRecord(item.doi) ? item.doi : {}),
                doiId: fieldValue,
              })
            }
            placeholder="10.1234/example"
          />
          <Field
            label="DOI URL"
            value={asString(isRecord(item.doi) ? item.doi.doiUrl : undefined)}
            onChange={(fieldValue) =>
              update('doi', {
                ...(isRecord(item.doi) ? item.doi : {}),
                doiUrl: fieldValue,
              })
            }
            type="url"
            placeholder="https://doi.org/10.1234/example"
          />
          <Field
            label="URL"
            value={asString(item.url)}
            onChange={(fieldValue) => update('url', fieldValue)}
            type="url"
            placeholder="https://example.com/paper"
          />
          <Field
            label="Icon URL"
            value={asString(item.icon)}
            onChange={(fieldValue) => update('icon', fieldValue)}
            type="url"
            placeholder="https://example.com/icon.svg"
          />
          <StringArrayEditor
            label="Co-Authors"
            value={
              Array.isArray(item.coAuthors)
                ? item.coAuthors.filter(
                    (author): author is string => typeof author === 'string'
                  )
                : []
            }
            onChange={(fieldValue) => update('coAuthors', fieldValue)}
            placeholder="Co-author"
          />
          <div className="md:col-span-2">
            <TextAreaField
              label="Description"
              value={asString(item.description)}
              onChange={(fieldValue) => update('description', fieldValue)}
              placeholder="Short optional description"
            />
          </div>
        </>
      )}
    />
  );
}

interface PublicProfileEditorProps {
  initialData: PublicProfileInitialData;
  targetEmail?: string;
  targetName?: string;
  from?: ProfileToolSource;
  backHref?: string;
  backLabel?: string;
}

export default function PublicProfileEditor({
  initialData,
  targetEmail,
  targetName,
  from = 'profile',
  backHref,
  backLabel,
}: PublicProfileEditorProps) {
  const router = useRouter();
  const beginOperationPolling = useOperationPollingSignal();
  const fallbackBackRoute = profileToolBackRoute(from);
  const resolvedBackHref = backHref ?? fallbackBackRoute.href;
  const resolvedBackLabel = backLabel ?? fallbackBackRoute.label;
  const initialFallbackKind = defaultKindForEmptyProfile(
    initialData.schema.allowedKinds
  );
  const initialPublishedProfile = initialData.profile.profile;
  const initialDraftProfile = isRecord(initialData.pr.draftProfile)
    ? initialData.pr.draftProfile
    : null;
  const initialEditableProfile =
    initialDraftProfile ??
    initialPublishedProfile ??
    emptyProfile(initialData.pr.profileKind ?? initialFallbackKind);
  const initialProfileKind =
    initialData.pr.profileKind ??
    initialData.profile.profileKind ??
    inferProfileKind(initialEditableProfile, initialFallbackKind);
  const [schema, setSchema] = useState<ProfileSchemaResponse>(
    initialData.schema
  );
  const [pr, setPr] = useState<PublicProfilePr>(initialData.pr);
  const [draftProfile, setDraftProfile] = useState<ProfileRecord | null>(
    initialDraftProfile
  );
  const [profileKind, setProfileKind] =
    useState<ProfileKind>(initialProfileKind);
  const [editorState, setEditorState] = useState<EditorState<ProfileRecord>>(
    () => createEditorState(initialEditableProfile, initialPublishedProfile)
  );
  const profile = editorState.draft;
  const publishedProfile = editorState.published;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [placementLoading, setPlacementLoading] = useState(false);

  const allowedKinds = schema?.allowedKinds.length
    ? schema.allowedKinds
    : [profileKind];
  const lockedFields = schema?.lockedFields ?? [];

  function profileUrl() {
    return targetEmail
      ? adminPublicProfileApiUrl(targetEmail)
      : publicProfileApiUrl();
  }

  function profileSchemaUrl() {
    return targetEmail
      ? adminPublicProfileSchemaApiUrl(targetEmail)
      : publicProfileSchemaApiUrl();
  }

  function profileStudentPlacementUrl() {
    return targetEmail
      ? adminPublicProfileStudentPlacementApiUrl(targetEmail)
      : publicProfileStudentPlacementApiUrl();
  }

  function profilePrUrl() {
    return targetEmail
      ? adminPublicProfilePrApiUrl(targetEmail)
      : publicProfilePrApiUrl();
  }

  function setEditableProfile(nextProfile: ProfileRecord) {
    setEditorState((current) => updateEditorDraft(current, nextProfile));
    setDraftProfile(nextProfile);
  }

  async function refresh() {
    setLoading(true);
    try {
      const [schemaRes, profileRes, prRes] = await Promise.all([
        fetch(profileSchemaUrl(), {
          credentials: 'include',
          cache: 'no-store',
          headers: apiHeaders(),
        }),
        fetch(profileUrl(), {
          credentials: 'include',
          cache: 'no-store',
          headers: apiHeaders(),
        }),
        fetch(profilePrUrl(), {
          credentials: 'include',
          cache: 'no-store',
          headers: apiHeaders(),
        }),
      ]);

      if (schemaRes.status === 401 || profileRes.status === 401) {
        router.push('/logout');
        return;
      }

      if (!schemaRes.ok)
        throw new Error((await readApiError(schemaRes)).message);
      if (!profileRes.ok && profileRes.status !== 404)
        throw new Error((await readApiError(profileRes)).message);
      if (!prRes.ok) throw new Error((await readApiError(prRes)).message);

      const nextSchema = (await schemaRes.json()) as ProfileSchemaResponse;
      const profileBody =
        profileRes.status === 404
          ? { profile: null }
          : normalizePublicProfileResponse(await profileRes.json());
      const nextPr = (await prRes.json()) as PublicProfilePr;
      const fallbackKind = defaultKindForEmptyProfile(nextSchema.allowedKinds);
      const nextPublishedProfile = profileBody.profile;
      const nextDraftProfile = isRecord(nextPr.draftProfile)
        ? nextPr.draftProfile
        : null;
      const editableProfile =
        nextDraftProfile ??
        nextPublishedProfile ??
        emptyProfile(nextPr.profileKind ?? fallbackKind);
      const nextKind =
        nextPr.profileKind ??
        profileBody.profileKind ??
        inferProfileKind(editableProfile, fallbackKind);

      setSchema(nextSchema);
      setPr(nextPr);
      setDraftProfile(nextDraftProfile);
      setProfileKind(nextKind);
      setEditorState(createEditorState(editableProfile, nextPublishedProfile));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  function handleKindChange(kind: ProfileKind) {
    setProfileKind(kind);
    const isCurrentStudent = profileKind === 'student';
    const isNextStudent = kind === 'student';
    const nextProfile =
      isCurrentStudent && isNextStudent
        ? profile
        : applyKindDefaults(kind, profile);
    setEditableProfile(normalizeStudentProfileFields(kind, nextProfile));
  }

  function handleProfileChange(nextProfile: ProfileRecord) {
    setEditorState((current) => updateEditorDraft(current, nextProfile));
    setDraftProfile(nextProfile);
  }

  async function refreshStudentPlacement(nextProfile = profile) {
    if (profileKind !== 'student') return;

    const studentType = asString(nextProfile.studentType) || 'UNDERGRADUATE';
    const body =
      studentType === 'POSTGRADUATE'
        ? {
            studentType,
            postgraduateProgramme:
              asString(nextProfile.postgraduateProgramme) || 'MSC',
          }
        : {
            studentType,
            studentTrack: asString(nextProfile.studentTrack) || 'GENERAL',
          };

    setPlacementLoading(true);
    try {
      const res = await fetch(profileStudentPlacementUrl(), {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        router.push('/logout');
        return;
      }

      if (!res.ok) {
        const error = await readApiError(res);
        toast.error(error.message ?? 'Failed to load student placement');
        return;
      }

      const placement = (await res.json()) as StudentPlacementResponse;
      setSchema((current) =>
        current
          ? {
              ...current,
              lockedFields: [
                ...new Set([
                  ...(current.lockedFields ?? []),
                  ...placement.lockedFields,
                ]),
              ],
              identity: current.identity
                ? { ...current.identity, studentPlacement: placement }
                : current.identity,
            }
          : current
      );

      const placedProfile: ProfileRecord = {
        ...nextProfile,
        registrationNo: placement.registrationNo,
        studentType: placement.studentType,
        status: placement.status,
      };
      if (placement.studentType === 'UNDERGRADUATE') {
        placedProfile.studentTrack = placement.studentTrack;
        placedProfile.level = placement.level;
        delete placedProfile.postgraduateProgramme;
        delete placedProfile.slqfLevel;
      } else {
        placedProfile.postgraduateProgramme = placement.postgraduateProgramme;
        placedProfile.slqfLevel = placement.slqfLevel;
        delete placedProfile.studentTrack;
        delete placedProfile.level;
      }

      handleProfileChange(placedProfile);
    } finally {
      setPlacementLoading(false);
    }
  }

  useEffect(() => {
    if (loading || profileKind !== 'student') return;
    const timer = window.setTimeout(() => {
      void refreshStudentPlacement(profile);
    }, 150);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loading,
    profileKind,
    profile.studentType,
    profile.studentTrack,
    profile.postgraduateProgramme,
  ]);

  function validateProfileDraft(value: unknown) {
    if (!isRecord(value)) {
      return {
        success: false as const,
        issues: [
          {
            field: 'profile-about',
            message: 'Profile JSON must contain one profile object.',
          },
        ],
      };
    }

    const trustedProfile = trustedProfileForSchema({
      profileKind,
      profile: value,
      identity: schema?.identity,
      lockedFields,
    });
    const pruned = pruneEmpty(trustedProfile);
    if (!isRecord(pruned)) {
      return {
        success: false as const,
        issues: [
          {
            field: 'profile-about',
            message: 'Profile must include the required public fields.',
          },
        ],
      };
    }

    const validation = schemaForKind(profileKind).safeParse(pruned);
    if (!validation.success) {
      return {
        success: false as const,
        issues: validation.error.issues.map((issue) => ({
          field: profileIssueField(issue.path),
          message: `${issue.path.join('.') || 'Profile'}: ${issue.message}`,
        })),
      };
    }

    return {
      success: true as const,
      data: validation.data as unknown as ProfileRecord,
    };
  }

  async function submit() {
    const trustedProfile = trustedProfileForSchema({
      profileKind,
      profile,
      identity: schema?.identity,
      lockedFields,
    });
    const pruned = pruneEmpty(trustedProfile);
    if (!isRecord(pruned)) {
      const message = 'Profile must include required fields.';
      setEditorState((current) => ({
        ...current,
        validationIssues: [{ field: 'profile-about', message }],
      }));
      toast.error(message);
      return;
    }

    const validation = schemaForKind(profileKind).safeParse(pruned);
    if (!validation.success) {
      const message = validationMessage(validation.error);
      setEditorState((current) => ({
        ...current,
        validationIssues: validation.error.issues.map((issue) => ({
          field: profileIssueField(issue.path),
          message: `${issue.path.join('.') || 'Profile'}: ${issue.message}`,
        })),
      }));
      toast.error(message);
      return;
    }

    const payloadProfile =
      profileKind === 'student'
        ? pruned
        : (validation.data as unknown as ProfileRecord);

    setSaving(true);
    try {
      const res = await fetch(profilePrUrl(), {
        method: 'PUT',
        credentials: 'include',
        headers: apiHeaders({
          'Content-Type': 'application/json',
          Prefer: 'respond-async',
        }),
        body: JSON.stringify({
          profileKind,
          ...(pr?.headSha
            ? { concurrency: { expectedPrHeadSha: pr.headSha } }
            : {
                concurrency: {
                  expectedUserFileSha: pr?.currentUserFileSha ?? null,
                },
              }),
          control: {
            idempotencyKey: crypto.randomUUID(),
            expectedRevision:
              pr?.revision ?? pr?.currentUserFileSha ?? 'missing',
          },
          profile: payloadProfile,
        }),
      });

      if (res.status === 401) {
        router.push('/logout');
        return;
      }

      if (!res.ok) {
        const body = await readApiError(res);
        toast.error(body.message ?? 'Failed to submit profile PR');
        return;
      }

      const operation = await waitForMutationOperation(
        (await res.json()) as MutationAccepted,
        'Profile update is still queued. Refresh to check its status.',
        { signal: beginOperationPolling() }
      );
      assertMutationSucceeded(operation);
      await refresh();
      toast.success(
        operation.outcome.pullRequest?.number
          ? `Profile PR #${operation.outcome.pullRequest.number} is ready`
          : 'Profile PR is ready'
      );
    } catch (error) {
      if (isOperationPollingAbort(error)) return;
      toast.error(
        error instanceof Error ? error.message : 'Failed to submit profile PR'
      );
    } finally {
      setSaving(false);
    }
  }

  async function discardDraft() {
    if (!targetEmail || !pr?.number || !pr.headSha) {
      toast.error('Draft details are not ready yet.');
      return;
    }

    setDiscarding(true);
    try {
      const res = await fetch(profilePrUrl(), {
        method: 'DELETE',
        credentials: 'include',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          prNumber: pr.number,
          expectedHeadSha: pr.headSha,
          reason: 'Superseded by newer public profile data',
        }),
      });

      if (res.status === 401) {
        router.push('/logout');
        return;
      }

      if (!res.ok) {
        const body = await readApiError(res);
        toast.error(body.message ?? 'Failed to discard draft');
        return;
      }

      toast.success('Stale draft discarded');
      await refresh();
    } catch {
      toast.error('Failed to discard draft');
    } finally {
      setDiscarding(false);
    }
  }

  const hasOpenDraft = pr?.status === 'open' && Boolean(draftProfile);
  const editorStatus: EditorRecordStatus = saving
    ? 'submitting'
    : hasOpenDraft
      ? 'draft'
      : publishedProfile
        ? 'published'
        : 'new';

  if (loading && !schema) {
    return <PageLoading variant="detail" />;
  }

  return (
    <PageShell width="wide">
      <BackButton
        fallbackHref={resolvedBackHref}
        label={resolvedBackLabel}
        preferFallback
      />
      <PageHeader
        title={targetEmail ? 'Public Profile Admin Edit' : 'Public Profile'}
        description={
          targetEmail
            ? `Edit ${targetName || targetEmail}'s public people-directory profile and submit it through an automated GitHub PR.`
            : 'Edit the public people directory profile and submit it through an automated GitHub PR.'
        }
        action={
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Pending PR</CardTitle>
          <CardDescription>
            Edits update the current open PR. After it is merged, the next edit
            creates a new PR.
          </CardDescription>
        </CardHeader>
        <CardContent
          className="flex flex-col gap-3 sm:flex-row sm:items-center
            sm:justify-between"
        >
          <div className="space-y-2">
            <Badge
              variant="outline"
              className={statusBadgeClass(pr?.status ?? 'none')}
            >
              {pr?.status ?? 'none'}
            </Badge>
            {pr?.branch ? (
              <p className="text-muted-foreground text-sm">{pr.branch}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {pr?.url ? (
              <Button
                asChild
                variant="outline"
                className={statusButtonClass(pr.status)}
              >
                <a href={pr.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 size-4" />
                  Open PR #{pr.number}
                </a>
              </Button>
            ) : null}
            {targetEmail && pr?.status === 'open' && pr.number && pr.headSha ? (
              <Button
                variant="outline"
                onClick={() => void discardDraft()}
                disabled={discarding}
                className="border-destructive/40 text-destructive
                  hover:bg-destructive/10"
              >
                <XCircle className="mr-2 size-4" />
                {discarding ? 'Discarding...' : 'Discard draft'}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile editor</CardTitle>
          <CardDescription>
            {hasOpenDraft
              ? 'An unmerged PR draft exists. Submitting updates that same draft.'
              : (schema?.note ?? 'Loading the profile schema details.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <EditorWorkspace
            state={editorState}
            onStateChange={(nextState) => {
              setEditorState(nextState);
              setDraftProfile(nextState.draft);
            }}
            title={
              targetEmail
                ? `${targetName || targetEmail}'s profile`
                : 'Your public profile'
            }
            status={editorStatus}
            statusDetail={
              hasOpenDraft
                ? `Editing the draft in PR #${pr?.number}.`
                : publishedProfile
                  ? 'Published data is available for comparison.'
                  : 'No public profile has been published yet.'
            }
            sections={PROFILE_EDITOR_SECTIONS}
            canEditJson={!saving && !loading}
            submitting={saving || loading || placementLoading}
            submitLabel="Submit Profile Changes"
            validateJson={validateProfileDraft}
            onSubmit={() => void submit()}
            renderEdit={(draft) => (
              <div className="space-y-8">
                <div
                  className="bg-muted/20 text-muted-foreground rounded-md border
                    p-3 text-sm"
                >
                  {hasOpenDraft
                    ? `Submitting updates the current PR #${pr?.number}.`
                    : placementLoading
                      ? 'Refreshing official student placement fields.'
                      : 'Complete the guided sections, then review the public information.'}
                </div>
                <OptionGrid
                  label="Profile Type"
                  value={profileKind}
                  options={allowedKinds}
                  onChange={(value) => handleKindChange(value as ProfileKind)}
                  required
                  labels={PROFILE_LABELS}
                />
                <ProfileForm
                  profileKind={profileKind}
                  profile={draft}
                  identity={schema?.identity}
                  lockedFields={lockedFields}
                  onProfileChange={handleProfileChange}
                />
              </div>
            )}
            renderReview={(draft, published, onChangeField) => (
              <PublicProfileReview
                draft={draft}
                published={published}
                profileKind={profileKind}
                onChangeField={onChangeField}
              />
            )}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}
