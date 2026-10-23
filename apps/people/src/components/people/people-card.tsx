'use client';

import { Badge } from '@scs/ui/components/badge';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@scs/ui/components/tabs';
import { cn } from 'cn';
import {
  BriefcaseBusiness,
  Building2,
  ExternalLink,
  FileText,
  Globe,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  User,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import {
  FaBluesky,
  FaFacebookF,
  FaGithub,
  FaInstagram,
  FaLinkedinIn,
  FaMastodon,
  FaXTwitter,
  FaYoutube,
} from 'react-icons/fa6';

import type {
  AcademicTeachingStaff,
  Publication,
  SocialLinks,
  Staff,
  Student,
} from '@/lib/types';
import {
  ACADEMIC_RANK_LABELS,
  ACADEMIC_SUPPORT_POSITION_LABELS,
  getAcademicDepartmentLabel,
  getAcademicSubjectLabel,
  getAcademicUnitLabel,
  getHonoursProgrammeLabel,
  getPostgraduateProgrammeLabel,
  getSlqfLevelLabel,
  getStudentLevelLabel,
  getStudentRoleLabel,
  NON_ACADEMIC_POSITION_LABELS,
} from '@/lib/types';

function initialsFrom(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function PersonImage({
  src,
  name,
  size = 'md',
}: {
  src?: string;
  name: string;
  size?: 'md' | 'lg';
}) {
  const sizeClass = size === 'lg' ? 'h-80 w-full' : 'size-24 sm:h-40 sm:w-full';

  if (!src) {
    return (
      <div
        role="img"
        aria-label={name}
        className={`${sizeClass} bg-accent/15 text-primary ring-primary/15 flex
          shrink-0 items-center justify-center rounded-md text-lg font-semibold
          ring-1`}
      >
        {initialsFrom(name)}
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} bg-accent/10 ring-primary/20 shrink-0
        overflow-hidden rounded-md ring-1`}
    >
      <Image
        src={src}
        alt={name}
        width={size === 'lg' ? 352 : 320}
        height={size === 'lg' ? 448 : 200}
        className="size-full object-cover"
        priority={size === 'lg'}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

function getRoleLabel(staff: Staff): string {
  if (staff.staffType === 'ACADEMIC_TEACHING') {
    return ACADEMIC_RANK_LABELS[staff.academicRank];
  }
  if (staff.staffType === 'ACADEMIC_SUPPORT') {
    return ACADEMIC_SUPPORT_POSITION_LABELS[staff.designation];
  }
  return NON_ACADEMIC_POSITION_LABELS[staff.designation];
}

function getStaffLink(staff: Staff): string | undefined {
  const username = staff.email?.split('@')[0];
  if (!username) return undefined;

  return `/people/${encodeURIComponent(username.toLowerCase())}`;
}

function PersonTile({
  href,
  imageUrl,
  name,
  title,
  subtitle,
  meta,
}: {
  href?: string;
  imageUrl?: string;
  name: string;
  title: string;
  subtitle: string;
  meta?: string;
}) {
  const content = (
    <>
      <PersonImage src={imageUrl} name={name} />
      <CardHeader
        className="min-w-0 flex-1 items-start px-0 text-left sm:min-h-28
          sm:w-full sm:items-center sm:text-center"
      >
        <CardTitle
          className="text-card-foreground group-hover:text-primary line-clamp-2
            text-sm/snug sm:text-base"
        >
          {title}
        </CardTitle>
        <p
          className="text-muted-foreground mt-1 max-w-full truncate text-sm
            sm:mt-2"
        >
          {subtitle}
        </p>
        {meta && (
          <p className="text-muted-foreground mt-1 max-w-full truncate text-xs">
            {meta}
          </p>
        )}
      </CardHeader>
      {href && (
        <CardFooter
          className="ml-auto self-end px-0 sm:mt-auto sm:w-full sm:self-auto"
        >
          <span
            className="border-primary/30 text-primary group-hover:border-primary
              group-hover:bg-primary group-hover:text-primary-foreground
              rounded-md border px-3 py-2 text-center text-sm font-medium
              transition-colors sm:w-full"
          >
            View
          </span>
        </CardFooter>
      )}
    </>
  );

  const className =
    'group flex min-h-0 flex-row items-start gap-4 rounded-md p-3 transition-colors hover:border-primary/50 hover:bg-muted/40 sm:min-h-80 sm:flex-col sm:p-4';

  if (!href) {
    return <Card className={className}>{content}</Card>;
  }

  return (
    <Link href={href} className="block">
      <Card className={`${className} hover:bg-muted/60`}>{content}</Card>
    </Link>
  );
}

function PeopleCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-card flex min-h-0 animate-pulse flex-row items-start gap-4
        rounded-md border p-3 sm:min-h-80 sm:flex-col sm:p-4"
    >
      <div className="bg-muted size-24 shrink-0 rounded-md sm:h-40 sm:w-full" />
      <div
        className="flex min-w-0 flex-1 flex-col gap-3 sm:min-h-28 sm:w-full
          sm:items-center"
      >
        <div className="bg-muted h-4 w-3/4 rounded" />
        <div className="bg-muted h-3 w-1/2 rounded" />
        <div className="bg-muted h-3 w-2/3 rounded" />
        <div
          className="bg-muted mt-auto ml-auto h-9 w-16 rounded-md sm:ml-0
            sm:w-full"
        />
      </div>
    </div>
  );
}

export function PeopleCardSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4
        xl:grid-cols-5"
    >
      {Array.from({ length: count }, (_, index) => (
        <PeopleCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function StaffCard({ staff }: { staff: Staff }) {
  return (
    <PersonTile
      href={getStaffLink(staff)}
      imageUrl={staff.profileImageUrl}
      name={staff.fullName}
      title={`${staff.title} ${staff.fullName}`}
      subtitle={getRoleLabel(staff)}
      meta={staff.email ?? staff.mobilePhone}
    />
  );
}

export function StudentCard({
  student,
  subject,
}: {
  student: Student;
  subject: string;
}) {
  return (
    <PersonTile
      href={`/people/${encodeURIComponent(student.registrationNo.toLowerCase())}`}
      imageUrl={student.profileImageUrl}
      name={student.fullName}
      title={`${student.title} ${student.fullName}`}
      subtitle={getStudentRoleLabel(student)}
      meta={student.registrationNo || subject}
    />
  );
}

interface ProfileLink {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  priority: 'primary' | 'secondary';
}

interface ProfileField {
  label: string;
  value?: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface ProfileTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

const KNOWN_SOCIAL_LINKS = {
  linkedin: { label: 'LinkedIn', icon: FaLinkedinIn },
  github: { label: 'GitHub', icon: FaGithub },
  mastodon: { label: 'Mastodon', icon: FaMastodon },
  bluesky: { label: 'Bluesky', icon: FaBluesky },
  x: { label: 'X', icon: FaXTwitter },
  facebook: { label: 'Facebook', icon: FaFacebookF },
  instagram: { label: 'Instagram', icon: FaInstagram },
  youtube: { label: 'YouTube', icon: FaYoutube },
} as const;

function isStaffPerson(person: Staff | Student): person is Staff {
  return 'staffType' in person;
}

function isAcademicTeachingStaff(
  person: Staff | Student
): person is AcademicTeachingStaff {
  return isStaffPerson(person) && person.staffType === 'ACADEMIC_TEACHING';
}

function isStudentPerson(person: Staff | Student): person is Student {
  return 'registrationNo' in person;
}

function createMailLink(email?: string): string | undefined {
  return email ? `mailto:${email}` : undefined;
}

function createTelLink(phone?: string): string | undefined {
  return phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : undefined;
}

function compactDateRange(startDate?: string, endDate?: string): string {
  return [startDate, endDate].filter(Boolean).join(' - ');
}

function getResearchInterests(person: Staff | Student): string[] {
  if (isAcademicTeachingStaff(person)) {
    return (
      person.researchInterests?.flatMap((interest) => [
        ...(interest.primaryFocus ?? []),
        ...(interest.otherInterests ?? []),
      ]) ?? []
    );
  }

  if (isStudentPerson(person)) {
    return person.researchInterests ?? [];
  }

  return [];
}

function getPositions(person: Staff | Student) {
  if (isAcademicTeachingStaff(person)) return person.positionsHeld ?? [];
  if (isStudentPerson(person)) return person.positions ?? [];
  return [];
}

function getStudentProgrammeLabel(student: Student): string | undefined {
  if (student.postgraduateProgramme) {
    return getPostgraduateProgrammeLabel(student.postgraduateProgramme);
  }

  if (student.honoursProgramme) {
    return getHonoursProgrammeLabel(student.honoursProgramme);
  }

  return undefined;
}

function getStudentAcademicTags(student: Student): string[] {
  return [
    ...(student.subjects?.map(getAcademicSubjectLabel) ?? []),
    ...(student.honoursProgramme
      ? [getHonoursProgrammeLabel(student.honoursProgramme)]
      : []),
    ...(student.postgraduateProgramme
      ? [getPostgraduateProgrammeLabel(student.postgraduateProgramme)]
      : []),
    ...(student.slqfLevel ? [getSlqfLevelLabel(student.slqfLevel)] : []),
  ];
}

function getSocialProfileLinks(socialLinks?: SocialLinks): ProfileLink[] {
  const knownLinks = Object.entries(socialLinks?.urls ?? {}).flatMap(
    ([platform, href]) => {
      if (!href) return [];
      const known =
        KNOWN_SOCIAL_LINKS[platform as keyof typeof KNOWN_SOCIAL_LINKS];
      if (!known) return [];

      return [
        {
          label: known.label,
          href,
          icon: known.icon,
          priority: 'primary' as const,
        },
      ];
    }
  );

  const otherLinks =
    socialLinks?.otherPlatforms?.map((link) => ({
      label: link.platformName,
      href: link.url,
      icon: ExternalLink,
      priority: 'secondary' as const,
    })) ?? [];

  return [...knownLinks, ...otherLinks];
}

function getProfileLinks(person: Staff | Student): ProfileLink[] {
  const academic = isAcademicTeachingStaff(person) ? person : null;
  const socialLinks =
    academic?.socialLinks ??
    (isStudentPerson(person) ? person.socialLinks : undefined);
  const links: ProfileLink[] = [];

  if (person.email) {
    links.push({
      label: 'Email',
      href: createMailLink(person.email)!,
      icon: Mail,
      priority: 'primary',
    });
  }
  if (isStudentPerson(person) && person.personalEmail) {
    links.push({
      label: 'Personal Email',
      href: createMailLink(person.personalEmail)!,
      icon: Mail,
      priority: 'primary',
    });
  }
  if (person.mobilePhone) {
    links.push({
      label: 'Mobile',
      href: createTelLink(person.mobilePhone)!,
      icon: Phone,
      priority: 'primary',
    });
  }
  if (isStaffPerson(person) && person.officePhone) {
    links.push({
      label: 'Office',
      href: createTelLink(person.officePhone)!,
      icon: Phone,
      priority: 'primary',
    });
  }
  if (academic?.website) {
    links.push({
      label: 'Website',
      href: academic.website,
      icon: Globe,
      priority: 'primary',
    });
  }
  if (academic?.cvUrl) {
    links.push({
      label: 'CV',
      href: academic.cvUrl,
      icon: FileText,
      priority: 'primary',
    });
  }

  return [...links, ...getSocialProfileLinks(socialLinks)];
}

function ProfileLinkList({
  links,
  limit,
}: {
  links: ProfileLink[];
  limit?: number;
}) {
  const visibleLinks =
    typeof limit === 'number' ? links.slice(0, limit) : links;

  if (visibleLinks.length === 0) return null;

  return (
    <div className="grid gap-2">
      {visibleLinks.map((link) => {
        const Icon = link.icon;
        return (
          <a
            key={`${link.label}-${link.href}`}
            href={link.href}
            target={link.href.startsWith('http') ? '_blank' : undefined}
            rel={
              link.href.startsWith('http') ? 'noopener noreferrer' : undefined
            }
            className="bg-card hover:border-primary hover:text-primary flex
              min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm
              transition-colors"
          >
            <Icon className="size-4 shrink-0" aria-hidden={true} />
            <span className="truncate">{link.label}</span>
          </a>
        );
      })}
    </div>
  );
}

function ProfileIconLinkList({ links }: { links: ProfileLink[] }) {
  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => {
        const Icon = link.icon;
        return (
          <a
            key={`${link.label}-${link.href}`}
            href={link.href}
            target={link.href.startsWith('http') ? '_blank' : undefined}
            rel={
              link.href.startsWith('http') ? 'noopener noreferrer' : undefined
            }
            aria-label={link.label}
            title={link.label}
            className="bg-card text-muted-foreground hover:border-primary
              hover:bg-primary hover:text-primary-foreground inline-flex size-10
              items-center justify-center rounded-md border transition-colors"
          >
            <Icon className="size-5" aria-hidden={true} />
          </a>
        );
      })}
    </div>
  );
}

function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t py-5 first:border-t-0 first:pt-0">
      <h2 className="text-muted-foreground mb-3 text-sm font-semibold uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function FieldGrid({ fields }: { fields: ProfileField[] }) {
  const visibleFields = fields.filter((field) => field.value);

  if (visibleFields.length === 0) return null;

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {visibleFields.map((field) => {
        const Icon = field.icon;
        const value = field.href ? (
          <a href={field.href} className="hover:text-primary break-all">
            {field.value}
          </a>
        ) : (
          field.value
        );

        return (
          <Card key={field.label} className="rounded-md py-0">
            <CardContent className="p-4">
              <dt
                className="text-muted-foreground mb-1 flex items-center gap-2
                  text-xs font-medium uppercase"
              >
                {Icon && <Icon className="size-3.5" aria-hidden="true" />}
                {field.label}
              </dt>
              <dd className="text-card-foreground text-sm font-medium">
                {value}
              </dd>
            </CardContent>
          </Card>
        );
      })}
    </dl>
  );
}

function ChipList({
  items,
  tone = 'secondary',
}: {
  items: string[];
  tone?: 'secondary' | 'primary';
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge
          key={item}
          variant={tone === 'primary' ? 'outline' : 'secondary'}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm',
            tone === 'primary' && 'border-primary/25 bg-primary/10 text-primary'
          )}
        >
          {item}
        </Badge>
      ))}
    </div>
  );
}

function TimelineList({
  items,
}: {
  items: Array<{
    name?: string;
    title?: string;
    startDate?: string;
    endDate?: string;
    date?: string;
    location?: string;
    description?: string;
    website?: string;
  }>;
}) {
  if (items.length === 0) return null;

  return (
    <ul className="divide-y rounded-md border">
      {items.map((item, index) => {
        const title = item.title ?? item.name;
        const meta = [
          compactDateRange(item.startDate, item.endDate) || item.date,
          item.location,
        ]
          .filter(Boolean)
          .join(' / ');

        return (
          <li key={`${title}-${index}`} className="p-4">
            <p className="text-card-foreground font-medium">{title}</p>
            {meta && (
              <p className="text-muted-foreground mt-1 text-sm">{meta}</p>
            )}
            {item.description && (
              <p className="text-muted-foreground mt-2 text-sm">
                {item.description}
              </p>
            )}
            {item.website && (
              <a
                href={item.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary mt-2 inline-flex items-center gap-1
                  text-sm hover:underline"
              >
                Website
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function QualificationList({
  qualifications,
}: {
  qualifications: NonNullable<AcademicTeachingStaff['qualifications']>;
}) {
  if (qualifications.length === 0) return null;

  return (
    <ul className="divide-y rounded-md border">
      {qualifications.map((qualification, index) => (
        <li key={`${qualification.degree}-${index}`} className="p-4">
          <p className="text-card-foreground font-medium">
            {qualification.degree}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {[qualification.institution, qualification.graduationYear]
              .filter(Boolean)
              .join(' / ')}
          </p>
          {qualification.description && (
            <p className="text-muted-foreground mt-2 text-sm">
              {qualification.description}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function PublicationList({ publications }: { publications?: Publication[] }) {
  if (!publications?.length) return null;

  return (
    <ul className="divide-y rounded-md border">
      {publications.map((publication, index) => (
        <li key={`${publication.title}-${index}`} className="p-4">
          <p className="font-medium">{publication.title}</p>
          {(publication.journal || publication.publicationDate) && (
            <p className="text-muted-foreground mt-1 text-sm">
              {[publication.journal, publication.publicationDate]
                .filter(Boolean)
                .join(' / ')}
            </p>
          )}
          {publication.coAuthors?.length ? (
            <p className="text-muted-foreground mt-1 text-sm">
              Co-authors: {publication.coAuthors.join(', ')}
            </p>
          ) : null}
          {publication.description && (
            <p className="text-muted-foreground mt-2 text-sm">
              {publication.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {publication.doi?.doiUrl && (
              <a
                href={publication.doi.doiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                DOI{publication.doi.doiId ? `: ${publication.doi.doiId}` : ''}
              </a>
            )}
            {publication.url && (
              <a
                href={publication.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Publication link
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DetailedPersonCard({
  person,
  showIdentity = true,
  extraTabs = [],
}: {
  person: Staff | Student;
  showIdentity?: boolean;
  extraTabs?: ProfileTab[];
}) {
  const [activeTabId, setActiveTabId] = useState<string>();
  const isStaff = isStaffPerson(person);
  const academic = isAcademicTeachingStaff(person) ? person : null;
  const student = isStudentPerson(person) ? person : null;
  const role = isStaff ? getRoleLabel(person) : getStudentRoleLabel(person);
  const profileLinks = getProfileLinks(person);
  const visibleProfileLinks =
    profileLinks.length > 6
      ? profileLinks.filter((link) => link.priority === 'primary').slice(0, 6)
      : profileLinks;
  const allResearchInterests = getResearchInterests(person);
  const allPositions = getPositions(person);
  const publications = academic?.publications ?? student?.publications ?? [];
  const keyPublications = academic?.keyPublications ?? [];
  const researchOngoing = academic?.researchOngoing ?? [];
  const conferences = academic?.conferencesAttended ?? [];
  const awards = academic?.awards ?? [];
  const academicQualifications = academic?.qualifications ?? [];
  const supportQualifications =
    isStaff && person.staffType === 'ACADEMIC_SUPPORT'
      ? (person.qualifications ?? [])
      : [];
  const teachings = academic?.teachings ?? [];
  const studentAcademicTags = student ? getStudentAcademicTags(student) : [];
  const staffDepartment =
    isStaff && person.department
      ? getAcademicDepartmentLabel(person.department)
      : undefined;
  const staffUnit =
    isStaff && person.unit ? getAcademicUnitLabel(person.unit) : undefined;

  const overviewFields: ProfileField[] = [
    { label: 'Role', value: role, icon: User },
    student
      ? {
          label: 'Registration',
          value: student.registrationNo,
          icon: GraduationCap,
        }
      : {
          label: 'Staff Type',
          value: isStaff ? person.staffType.replaceAll('_', ' ') : undefined,
          icon: BriefcaseBusiness,
        },
    {
      label: 'Department',
      value: staffDepartment,
      icon: Building2,
    },
    {
      label: 'Unit',
      value: staffUnit,
      icon: Building2,
    },
    academic?.officeLocation
      ? {
          label: 'Office',
          value: academic.officeLocation,
          icon: MapPin,
        }
      : {
          label: 'Level',
          value: student ? getStudentLevelLabel(student.level) : undefined,
          icon: GraduationCap,
        },
    {
      label: 'Programme',
      value: student ? getStudentProgrammeLabel(student) : undefined,
      icon: GraduationCap,
    },
    {
      label: 'SLQF Level',
      value: student?.slqfLevel
        ? getSlqfLevelLabel(student.slqfLevel)
        : undefined,
      icon: GraduationCap,
    },
    {
      label: 'Email',
      value: person.email,
      href: createMailLink(person.email),
      icon: Mail,
    },
    {
      label: 'Mobile',
      value: person.mobilePhone,
      href: createTelLink(person.mobilePhone),
      icon: Phone,
    },
    {
      label: 'Personal Email',
      value: student?.personalEmail,
      href: createMailLink(student?.personalEmail),
      icon: Mail,
    },
    {
      label: 'Office Phone',
      value: isStaff ? person.officePhone : undefined,
      href: createTelLink(isStaff ? person.officePhone : undefined),
      icon: Phone,
    },
  ];

  const tabs: ProfileTab[] = (() => {
    const nextTabs: ProfileTab[] = [
      {
        id: 'overview',
        label: 'Overview',
        content: (
          <div className="space-y-5">
            <ProfileSection title="Profile">
              <FieldGrid fields={overviewFields} />
            </ProfileSection>
          </div>
        ),
      },
    ];

    if (
      academicQualifications.length > 0 ||
      supportQualifications.length > 0 ||
      teachings.length > 0 ||
      studentAcademicTags.length > 0 ||
      allResearchInterests.length > 0
    ) {
      nextTabs.push({
        id: 'academic',
        label: 'Academic',
        content: (
          <div className="space-y-5">
            {(academicQualifications.length > 0 ||
              supportQualifications.length > 0) && (
              <ProfileSection title="Qualifications">
                {academic ? (
                  <QualificationList qualifications={academicQualifications} />
                ) : (
                  <ChipList items={supportQualifications} />
                )}
              </ProfileSection>
            )}
            {teachings.length > 0 && (
              <ProfileSection title="Courses">
                <ChipList items={teachings} />
              </ProfileSection>
            )}
            {studentAcademicTags.length > 0 && (
              <ProfileSection title="Student Details">
                <ChipList items={studentAcademicTags} />
              </ProfileSection>
            )}
            {allResearchInterests.length > 0 && (
              <ProfileSection title="Research Interests">
                <ChipList items={allResearchInterests} tone="primary" />
              </ProfileSection>
            )}
          </div>
        ),
      });
    }

    if (
      researchOngoing.length > 0 ||
      keyPublications.length > 0 ||
      publications.length > 0 ||
      conferences.length > 0 ||
      awards.length > 0
    ) {
      nextTabs.push({
        id: 'research',
        label: 'Research',
        content: (
          <div className="space-y-5">
            {researchOngoing.length > 0 && (
              <ProfileSection title="Ongoing Research">
                <TimelineList items={researchOngoing} />
              </ProfileSection>
            )}
            {keyPublications.length > 0 && (
              <ProfileSection title="Key Publications">
                <PublicationList publications={keyPublications} />
              </ProfileSection>
            )}
            {publications.length > 0 && (
              <ProfileSection title="Publications">
                <PublicationList publications={publications} />
              </ProfileSection>
            )}
            {conferences.length > 0 && (
              <ProfileSection title="Conferences">
                <TimelineList items={conferences} />
              </ProfileSection>
            )}
            {awards.length > 0 && (
              <ProfileSection title="Awards">
                <TimelineList items={awards} />
              </ProfileSection>
            )}
          </div>
        ),
      });
    }

    if (allPositions.length > 0) {
      nextTabs.push({
        id: 'experience',
        label: 'Experience',
        content: (
          <ProfileSection title="Experience">
            <TimelineList items={allPositions} />
          </ProfileSection>
        ),
      });
    }

    if (profileLinks.length > 6) {
      nextTabs.push({
        id: 'links',
        label: 'Links',
        content: (
          <ProfileSection title="All Links">
            <ProfileLinkList links={profileLinks} />
          </ProfileSection>
        ),
      });
    }

    return [...nextTabs, ...extraTabs];
  })();

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  return (
    <article className="grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">
      <Card className="rounded-md p-5 lg:sticky lg:top-24">
        <PersonImage
          src={person.profileImageUrl}
          name={person.fullName}
          size="lg"
        />
        <div className="mt-5">
          {showIdentity && (
            <h1 className="text-card-foreground text-2xl/tight font-bold">
              {person.title} {person.fullName}
            </h1>
          )}
          <p className="text-primary mt-2 font-medium">{role}</p>
          {student && (
            <p className="text-muted-foreground mt-1 text-sm">
              {student.registrationNo}
            </p>
          )}
        </div>

        {visibleProfileLinks.length > 0 && (
          <section className="mt-4">
            <h2
              className="text-muted-foreground mb-2 text-xs font-semibold
                uppercase"
            >
              Links
            </h2>
            <ProfileIconLinkList links={visibleProfileLinks} />
            {profileLinks.length > visibleProfileLinks.length && (
              <p className="text-muted-foreground mt-2 text-xs">
                More links are available in the Links tab.
              </p>
            )}
          </section>
        )}
      </Card>

      <div className="min-w-0">
        {tabs.length > 1 && (
          <Tabs
            value={activeTab.id}
            onValueChange={setActiveTabId}
            className="mb-5"
          >
            <TabsList
              variant="brand"
              className="h-auto flex-wrap justify-start"
            >
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="min-h-8">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="hidden" />
            ))}
          </Tabs>
        )}

        <Card className="rounded-md p-5">{activeTab.content}</Card>
      </div>
    </article>
  );
}

export function DetailedPersonCardSkeleton() {
  return (
    <article aria-hidden="true" className="animate-pulse space-y-8">
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">
        <div className="bg-card rounded-md border p-5">
          <div className="bg-muted h-80 w-full rounded-md" />
          <div className="mt-5 space-y-3">
            <div className="bg-muted h-7 w-3/4 rounded" />
            <div className="bg-muted h-4 w-1/2 rounded" />
            <div className="bg-muted h-4 w-1/3 rounded" />
          </div>
          <div className="mt-6">
            <div className="bg-muted mb-3 h-3 w-12 rounded" />
            <div className="flex flex-wrap gap-2">
              <div className="bg-muted size-10 rounded-md" />
              <div className="bg-muted size-10 rounded-md" />
              <div className="bg-muted size-10 rounded-md" />
              <div className="bg-muted size-10 rounded-md" />
            </div>
          </div>
        </div>

        <div>
          <div className="mb-5 flex gap-2 border-b pb-3">
            <div className="bg-muted h-8 w-20 rounded-md" />
            <div className="bg-muted h-8 w-20 rounded-md" />
            <div className="bg-muted h-8 w-20 rounded-md" />
          </div>
          <div className="bg-card rounded-md border p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="bg-muted h-20 rounded-md" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
