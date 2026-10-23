'use client';

import { Badge } from '@scs/ui/components/badge';
import { Button } from '@scs/ui/components/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import { Checkbox } from '@scs/ui/components/checkbox';
import { Field, FieldLabel } from '@scs/ui/components/field';
import { Input } from '@scs/ui/components/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@scs/ui/components/select';
import { Switch } from '@scs/ui/components/switch';
import { cn } from 'cn';
import {
  CheckCircle2,
  GraduationCap,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UsersRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { PageLoading } from '@/components/feedback/page-loading';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { BackButton } from '@/components/navigation/back-button';
import {
  adminStudentPlacementMetadataApiUrl,
  adminStudentPlacementMetadataPrApiUrl,
  adminStudentPlacementMetadataPrCleanupApiUrl,
  adminStudentPlacementMetadataPrStatusApiUrl,
  apiHeaders,
  readApiError,
} from '@/lib/api';

type StudentTrack = 'GENERAL' | 'HONOURS';
type StudentLevel = '1000' | '2000' | '3000' | '4000';
type StudentStream = 'cs' | 'ds' | 'stat' | 'sor';
type SlqfLevel = 'L7' | 'L8' | 'L9' | 'L10' | 'L11' | 'L12';
type PostgraduateProgramme =
  | 'POSTGRADUATE_CERTIFICATE'
  | 'POSTGRADUATE_DIPLOMA'
  | 'MASTERS_COURSEWORK'
  | 'MSC'
  | 'MPHIL'
  | 'MPHIL_UPGRADE_FROM_MSC'
  | 'PHD'
  | 'PHD_UPGRADE_FROM_MSC'
  | 'PHD_UPGRADE_FROM_MPHIL';

interface PlacementRule {
  batch: string;
  studentTrack: StudentTrack;
  level: StudentLevel;
}

interface AlumniRule {
  batch: string;
  studentTracks: StudentTrack[];
}

interface PostgraduateProgrammeRule {
  programme: PostgraduateProgramme;
  label: string;
  slqfLevel: SlqfLevel;
}

interface StudentStreamRule {
  stream: StudentStream;
  label: string;
  directory?: string;
  publicDirectory: boolean;
}

interface MetadataResponse {
  placement: PlacementRule[];
  alumni: AlumniRule[];
  postgraduateProgrammes: PostgraduateProgrammeRule[];
  studentStreams: StudentStreamRule[];
}

interface StudentPlacementPr {
  status: 'none' | 'open' | 'merged' | 'closed';
  number?: number;
  url?: string;
  branch?: string;
  headSha?: string;
  canEdit: boolean;
  updatedAt?: string;
}

const TRACKS: StudentTrack[] = ['GENERAL', 'HONOURS'];
const LEVELS: StudentLevel[] = ['1000', '2000', '3000', '4000'];
const SLQF_LEVELS: SlqfLevel[] = ['L7', 'L8', 'L9', 'L10', 'L11', 'L12'];

const TRACK_LABELS: Record<StudentTrack, string> = {
  GENERAL: 'General',
  HONOURS: 'Honours',
};

const LEVEL_LABELS: Record<StudentLevel, string> = {
  '1000': '1000 Level',
  '2000': '2000 Level',
  '3000': '3000 Level',
  '4000': '4000 Level',
};

function placementLevelsForTrack(track: StudentTrack) {
  return track === 'GENERAL'
    ? LEVELS.filter((level) => level !== '4000')
    : LEVELS;
}

function levelForTrack(track: StudentTrack, level: StudentLevel) {
  return track === 'GENERAL' && level === '4000' ? '3000' : level;
}

function normalizeBatch(value: string) {
  return value.trim().toLowerCase();
}

function trackSelected(rule: AlumniRule, track: StudentTrack) {
  return rule.studentTracks.includes(track);
}

function updateTrack(rule: AlumniRule, track: StudentTrack, checked: boolean) {
  const tracks = new Set(rule.studentTracks);
  if (checked) tracks.add(track);
  else tracks.delete(track);
  return { ...rule, studentTracks: TRACKS.filter((item) => tracks.has(item)) };
}

function placementKey(batch: string, track: StudentTrack) {
  return `${normalizeBatch(batch)}:${track}`;
}

function hasPlacementRule(
  placement: PlacementRule[],
  batch: string,
  track: StudentTrack
) {
  return placement.some(
    (rule) =>
      normalizeBatch(rule.batch) === normalizeBatch(batch) &&
      rule.studentTrack === track
  );
}

function findMissingAlumniPlacement(data: MetadataResponse) {
  for (const rule of data.alumni) {
    for (const track of rule.studentTracks) {
      if (!hasPlacementRule(data.placement, rule.batch, track)) {
        return { batch: rule.batch, track };
      }
    }
  }
  return null;
}

function prStatusVariant(
  status: StudentPlacementPr['status']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'open') {
    return 'default';
  }
  if (status === 'merged') {
    return 'secondary';
  }
  if (status === 'closed') {
    return 'destructive';
  }
  return 'outline';
}

function statusLabel(status: StudentPlacementPr['status']) {
  if (status === 'none') return 'No draft';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function StudentPlacementPage() {
  const [data, setData] = useState<MetadataResponse | null>(null);
  const [pr, setPr] = useState<StudentPlacementPr | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPr, setLoadingPr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closingPrs, setClosingPrs] = useState(false);
  const [bulkBatches, setBulkBatches] = useState('');
  const [bulkTrack, setBulkTrack] = useState<StudentTrack>('GENERAL');
  const [bulkLevel, setBulkLevel] = useState<StudentLevel>('3000');
  const [bulkAlumni, setBulkAlumni] = useState(false);

  const alumniTrackCount = useMemo(
    () =>
      data?.alumni.reduce(
        (total, rule) => total + rule.studentTracks.length,
        0
      ) ?? 0,
    [data?.alumni]
  );
  const placementKeys = useMemo(
    () =>
      new Set(
        data?.placement.map((rule) =>
          placementKey(rule.batch, rule.studentTrack)
        ) ?? []
      ),
    [data?.placement]
  );

  const refreshPrStatus = useCallback(async () => {
    setLoadingPr(true);
    try {
      const res = await fetch(adminStudentPlacementMetadataPrStatusApiUrl(), {
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders(),
      });
      if (!res.ok) throw new Error((await readApiError(res)).message);
      setPr((await res.json()) as StudentPlacementPr);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to load placement PR status'
      );
    } finally {
      setLoadingPr(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const statusPromise = refreshPrStatus();
    try {
      const res = await fetch(adminStudentPlacementMetadataApiUrl(), {
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders(),
      });
      if (!res.ok) throw new Error((await readApiError(res)).message);
      const nextData = (await res.json()) as MetadataResponse;
      setData({
        ...nextData,
        studentStreams: nextData.studentStreams ?? [],
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load');
    } finally {
      await statusPromise;
      setLoading(false);
    }
  }, [refreshPrStatus]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  function setPlacement(index: number, patch: Partial<PlacementRule>) {
    setData((current) =>
      current
        ? {
            ...current,
            placement: current.placement.map((rule, ruleIndex) =>
              ruleIndex === index ? { ...rule, ...patch } : rule
            ),
          }
        : current
    );
  }

  function setAlumni(index: number, rule: AlumniRule) {
    setData((current) =>
      current
        ? {
            ...current,
            alumni: rule.studentTracks.length
              ? current.alumni.map((item, itemIndex) =>
                  itemIndex === index ? rule : item
                )
              : current.alumni.filter((_, itemIndex) => itemIndex !== index),
          }
        : current
    );
  }

  function setProgramme(
    index: number,
    patch: Partial<PostgraduateProgrammeRule>
  ) {
    setData((current) =>
      current
        ? {
            ...current,
            postgraduateProgrammes: current.postgraduateProgrammes.map(
              (rule, ruleIndex) =>
                ruleIndex === index ? { ...rule, ...patch } : rule
            ),
          }
        : current
    );
  }

  function applyBulkUpdate() {
    const batches = bulkBatches
      .split(/[,\s]+/)
      .map(normalizeBatch)
      .filter((batch) => /^s\d{2}$/.test(batch));
    if (!batches.length) {
      toast.error('Enter at least one batch like s21.');
      return;
    }
    if (bulkAlumni && data) {
      const missingBatch = batches.find(
        (batch) => !hasPlacementRule(data.placement, batch, bulkTrack)
      );
      if (missingBatch) {
        toast.error(
          `Add ${missingBatch.toUpperCase()} ${TRACK_LABELS[bulkTrack]} level before marking alumni.`
        );
        return;
      }
    }

    setData((current) => {
      if (!current) return current;
      const placement = [...current.placement];
      const alumni = [...current.alumni];

      for (const batch of batches) {
        const placementIndex = placement.findIndex(
          (rule) => rule.batch === batch && rule.studentTrack === bulkTrack
        );
        const existingPlacement =
          placementIndex >= 0 ? placement[placementIndex] : undefined;
        const nextPlacement = {
          batch,
          studentTrack: bulkTrack,
          level:
            bulkAlumni && existingPlacement
              ? existingPlacement.level
              : bulkLevel,
        };
        if (placementIndex >= 0) placement[placementIndex] = nextPlacement;
        else placement.push(nextPlacement);

        const alumniIndex = alumni.findIndex((rule) => rule.batch === batch);
        const currentAlumni =
          alumniIndex >= 0 ? alumni[alumniIndex] : { batch, studentTracks: [] };
        const nextAlumni = updateTrack(currentAlumni, bulkTrack, bulkAlumni);
        if (alumniIndex >= 0) alumni[alumniIndex] = nextAlumni;
        else if (nextAlumni.studentTracks.length) alumni.push(nextAlumni);
      }

      return { ...current, placement, alumni };
    });
    toast.success('Bulk update applied');
  }

  function addAlumniRule() {
    if (!data) return;
    const nextPlacement = data.placement.find(
      (placement) =>
        !data.alumni.some(
          (rule) =>
            normalizeBatch(rule.batch) === normalizeBatch(placement.batch) &&
            rule.studentTracks.includes(placement.studentTrack)
        )
    );
    if (!nextPlacement) {
      toast.error('Add an undergraduate level rule before marking alumni.');
      return;
    }

    setData((current) => {
      if (!current) return current;
      const alumniIndex = current.alumni.findIndex(
        (rule) =>
          normalizeBatch(rule.batch) === normalizeBatch(nextPlacement.batch)
      );
      const nextRule = updateTrack(
        alumniIndex >= 0
          ? current.alumni[alumniIndex]
          : { batch: nextPlacement.batch, studentTracks: [] },
        nextPlacement.studentTrack,
        true
      );
      return {
        ...current,
        alumni:
          alumniIndex >= 0
            ? current.alumni.map((rule, index) =>
                index === alumniIndex ? nextRule : rule
              )
            : [...current.alumni, nextRule],
      };
    });
  }

  async function submit() {
    if (!data) return;
    const missingPlacement = findMissingAlumniPlacement(data);
    if (missingPlacement) {
      toast.error(
        `Add ${missingPlacement.batch.toUpperCase()} ${TRACK_LABELS[missingPlacement.track]} level before marking alumni.`
      );
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(adminStudentPlacementMetadataPrApiUrl(), {
        method: 'PUT',
        credentials: 'include',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await readApiError(res)).message);
      const nextPr = (await res.json()) as StudentPlacementPr;
      setPr(nextPr);
      toast.success(
        nextPr.number ? `PR #${nextPr.number} created` : 'PR created'
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit');
    } finally {
      setSaving(false);
    }
  }

  async function closePlacementPrs() {
    setClosingPrs(true);
    try {
      const res = await fetch(adminStudentPlacementMetadataPrCleanupApiUrl(), {
        method: 'DELETE',
        credentials: 'include',
        headers: apiHeaders(),
      });
      if (!res.ok) throw new Error((await readApiError(res)).message);
      const cleanup = (await res.json()) as { closed?: number };
      toast.success(
        cleanup.closed
          ? `Closed ${cleanup.closed} stale placement PR${cleanup.closed === 1 ? '' : 's'}.`
          : 'No stale placement PRs found.'
      );
      await refreshPrStatus();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to close placement PRs'
      );
    } finally {
      setClosingPrs(false);
    }
  }

  if (loading && !data) return <PageLoading variant="detail" />;

  return (
    <PageShell width="wide">
      <div className="min-w-0 space-y-6">
        <BackButton
          fallbackHref="/admin"
          label="Back to Admin"
          preferFallback
        />
        <PageHeader
          title="Academic Rules"
          description="Trusted undergraduate level, alumni, and postgraduate SLQF rules."
          action={
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={closePlacementPrs}
                disabled={closingPrs || loadingPr || pr?.status !== 'open'}
              >
                <Trash2 data-icon="inline-start" />
                {closingPrs ? 'Closing...' : 'Close Drafts'}
              </Button>
              <Button variant="outline" onClick={refresh} disabled={loading}>
                <RefreshCw data-icon="inline-start" />
                Refresh
              </Button>
            </div>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric
            icon={UsersRound}
            label="Undergraduate Rules"
            value={data?.placement.length ?? 0}
          />
          <Metric
            icon={CheckCircle2}
            label="Alumni Tracks"
            value={alumniTrackCount}
          />
          <Metric
            icon={GraduationCap}
            label="Postgraduate"
            value={data?.postgraduateProgrammes.length ?? 0}
          />
        </div>

        <Card className="min-w-0">
          <CardHeader className="has-data-[slot=card-action]:grid-cols-1 sm:has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Academic Rules PR</CardTitle>
                <Badge variant={prStatusVariant(pr?.status ?? 'none')}>
                  {loadingPr ? 'Loading' : statusLabel(pr?.status ?? 'none')}
                </Badge>
              </div>
              <CardDescription>
                One metadata PR covers undergraduate levels, alumni tracks, and
                postgraduate programme rules.
              </CardDescription>
            </div>
            <CardAction className="col-start-1 row-start-auto justify-self-start sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:justify-self-end">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshPrStatus}
                disabled={loadingPr}
              >
                <RefreshCw data-icon="inline-start" />
                Refresh Status
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid min-w-0 gap-1 text-sm text-muted-foreground">
              {pr?.number && pr.url ? (
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  PR #{pr.number}
                </a>
              ) : (
                <span>No student placement metadata PR found.</span>
              )}
              {pr?.branch ? (
                <span className="min-w-0 break-all">Branch: {pr.branch}</span>
              ) : null}
              {pr?.updatedAt ? (
                <span>Updated: {new Date(pr.updatedAt).toLocaleString()}</span>
              ) : null}
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={refresh} disabled={loading}>
              <RefreshCw data-icon="inline-start" />
              Refresh
            </Button>
            <Button onClick={submit} disabled={saving || loading || !data}>
              <Save data-icon="inline-start" />
              {saving ? 'Submitting...' : 'Submit PR'}
            </Button>
          </CardFooter>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Bulk Update</CardTitle>
            <CardDescription>
              Apply placement and alumni state to multiple batches.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_7rem_7rem]">
            <FieldShell label="Batches">
              <Input
                value={bulkBatches}
                onChange={(event) => setBulkBatches(event.target.value)}
                placeholder="s21, s22"
              />
            </FieldShell>
            <SelectControl
              label="Track"
              value={bulkTrack}
              options={TRACKS}
              labels={TRACK_LABELS}
              onChange={(value) => {
                const track = value as StudentTrack;
                setBulkTrack(track);
                setBulkLevel((level) => levelForTrack(track, level));
              }}
            />
            <SelectControl
              label="Level"
              value={bulkLevel}
              options={placementLevelsForTrack(bulkTrack)}
              labels={LEVEL_LABELS}
              disabled={bulkAlumni}
              onChange={(value) => setBulkLevel(value as StudentLevel)}
            />
            <ToggleControl
              label="Alumni"
              checked={bulkAlumni}
              onChange={setBulkAlumni}
            />
            <div className="flex items-end">
              <Button
                type="button"
                className="w-full"
                onClick={applyBulkUpdate}
              >
                <Plus data-icon="inline-start" />
                Apply
              </Button>
            </div>
          </CardContent>
        </Card>

        <RulesSection
          title="Undergraduate Levels"
          description="Current academic level by batch and track. General tracks stop at 3000."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setData((current) =>
                  current
                    ? {
                        ...current,
                        placement: [
                          ...current.placement,
                          {
                            batch: 's21',
                            studentTrack: 'GENERAL',
                            level: '3000',
                          },
                        ],
                      }
                    : current
                )
              }
            >
              <Plus data-icon="inline-start" />
              Add
            </Button>
          }
        >
          <RuleGrid>
            <RuleGridHeader
              columns="md:grid-cols-[minmax(0,0.65fr)_minmax(0,1fr)_minmax(0,1fr)_2.5rem]"
              labels={['Batch', 'Track', 'Level', '']}
            />
            {data?.placement.map((rule, index) => (
              <RuleGridRow
                key={`${rule.batch}-${rule.studentTrack}-${index}`}
                columns="md:grid-cols-[minmax(0,0.65fr)_minmax(0,1fr)_minmax(0,1fr)_2.5rem]"
              >
                <FieldShell label="Batch" compact>
                  <Input
                    value={rule.batch}
                    onChange={(event) =>
                      setPlacement(index, {
                        batch: normalizeBatch(event.target.value),
                      })
                    }
                  />
                </FieldShell>
                <SelectControl
                  label="Track"
                  value={rule.studentTrack}
                  options={TRACKS}
                  labels={TRACK_LABELS}
                  compact
                  onChange={(value) => {
                    const studentTrack = value as StudentTrack;
                    setPlacement(index, {
                      studentTrack,
                      level: levelForTrack(studentTrack, rule.level),
                    });
                  }}
                />
                <SelectControl
                  label="Level"
                  value={levelForTrack(rule.studentTrack, rule.level)}
                  options={placementLevelsForTrack(rule.studentTrack)}
                  labels={LEVEL_LABELS}
                  compact
                  onChange={(value) =>
                    setPlacement(index, { level: value as StudentLevel })
                  }
                />
                <RemoveButton
                  label="Remove undergraduate rule"
                  onClick={() =>
                    setData((current) =>
                      current
                        ? {
                            ...current,
                            placement: current.placement.filter(
                              (_, itemIndex) => itemIndex !== index
                            ),
                          }
                        : current
                    )
                  }
                />
              </RuleGridRow>
            ))}
          </RuleGrid>
        </RulesSection>

        <RulesSection
          title="Alumni Tracks"
          description="Freeze a batch track as alumni only after that track has an undergraduate level rule."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addAlumniRule}
            >
              <Plus data-icon="inline-start" />
              Add
            </Button>
          }
        >
          <RuleGrid>
            <RuleGridHeader
              columns="md:grid-cols-[minmax(0,0.65fr)_minmax(0,1fr)_minmax(0,1fr)_2.5rem]"
              labels={['Batch', 'General', 'Honours', '']}
            />
            {data?.alumni.map((rule, index) => (
              <RuleGridRow
                key={`${rule.batch}-${index}`}
                columns="md:grid-cols-[minmax(0,0.65fr)_minmax(0,1fr)_minmax(0,1fr)_2.5rem]"
              >
                <FieldShell label="Batch" compact>
                  <Input
                    value={rule.batch}
                    onChange={(event) =>
                      setAlumni(index, {
                        ...rule,
                        batch: normalizeBatch(event.target.value),
                      })
                    }
                  />
                </FieldShell>
                {TRACKS.map((track) => {
                  const selected = trackSelected(rule, track);
                  const canSelect = placementKeys.has(
                    placementKey(rule.batch, track)
                  );
                  return (
                    <label
                      key={track}
                      className="flex h-9 min-w-0 items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={selected}
                        disabled={!selected && !canSelect}
                        onCheckedChange={(checked) => {
                          if (checked === true && !canSelect) {
                            toast.error(
                              `Add ${rule.batch.toUpperCase()} ${TRACK_LABELS[track]} level before marking alumni.`
                            );
                            return;
                          }
                          setAlumni(
                            index,
                            updateTrack(rule, track, checked === true)
                          );
                        }}
                      />
                      {TRACK_LABELS[track]}
                    </label>
                  );
                })}
                <RemoveButton
                  label="Remove alumni rule"
                  onClick={() =>
                    setData((current) =>
                      current
                        ? {
                            ...current,
                            alumni: current.alumni.filter(
                              (_, itemIndex) => itemIndex !== index
                            ),
                          }
                        : current
                    )
                  }
                />
              </RuleGridRow>
            ))}
          </RuleGrid>
        </RulesSection>

        <RulesSection
          title="Postgraduate SLQF Programmes"
          description="Programme labels and locked SLQF framework levels used by public profile forms."
        >
          <RuleGrid>
            <RuleGridHeader
              columns="md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_8rem]"
              labels={['Programme', 'Label', 'SLQF']}
            />
            {data?.postgraduateProgrammes.map((rule, index) => (
              <RuleGridRow
                key={rule.programme}
                columns="md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_8rem]"
              >
                <FieldShell label="Programme" compact>
                  <Input value={rule.programme} readOnly />
                </FieldShell>
                <FieldShell label="Label" compact>
                  <Input
                    value={rule.label}
                    onChange={(event) =>
                      setProgramme(index, { label: event.target.value })
                    }
                  />
                </FieldShell>
                <SelectControl
                  label="SLQF"
                  value={rule.slqfLevel}
                  options={SLQF_LEVELS}
                  compact
                  onChange={(value) =>
                    setProgramme(index, { slqfLevel: value as SlqfLevel })
                  }
                />
              </RuleGridRow>
            ))}
          </RuleGrid>
        </RulesSection>
      </div>
    </PageShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UsersRound;
  label: string;
  value: number;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="gap-0">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        <CardAction>
          <Icon className="text-muted-foreground" aria-hidden="true" />
        </CardAction>
      </CardHeader>
    </Card>
  );
}

function RulesSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="min-w-0 w-full max-w-3xl has-data-[slot=card-action]:grid-cols-1 sm:has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <CardTitle className="min-w-0 text-wrap">{title}</CardTitle>
          {description ? (
            <CardDescription className="mt-1">{description}</CardDescription>
          ) : null}
        </div>
        {action ? (
          <CardAction className="col-start-1 row-start-auto justify-self-start sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:justify-self-end">
            {action}
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="min-w-0 w-full max-w-3xl">{children}</CardContent>
    </Card>
  );
}

function RuleGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid min-w-0 gap-2">{children}</div>;
}

function RuleGridHeader({
  columns,
  labels,
}: {
  columns: string;
  labels: string[];
}) {
  return (
    <div
      className={cn(
        'hidden min-w-0 gap-3 border-b pb-2 text-sm font-medium text-muted-foreground md:grid',
        columns
      )}
    >
      {labels.map((label, index) => (
        <span key={`${label}-${index}`} className="min-w-0 truncate">
          {label}
        </span>
      ))}
    </div>
  );
}

function RuleGridRow({
  columns,
  children,
}: {
  columns: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid min-w-0 gap-3 rounded-md border p-3 md:border-0 md:border-b md:p-0 md:pb-2',
        columns
      )}
    >
      {children}
    </div>
  );
}

function FieldShell({
  label,
  compact = false,
  children,
}: {
  label: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Field className="min-w-0 [&>*]:min-w-0">
      <FieldLabel
        className={compact ? 'md:sr-only md:!w-px md:!min-w-0' : undefined}
      >
        {label}
      </FieldLabel>
      {children}
    </Field>
  );
}

function RemoveButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-destructive"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Trash2 />
    </Button>
  );
}

function ToggleControl({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Field orientation="horizontal" className="h-9 min-w-0 items-end">
      <FieldLabel>{label}</FieldLabel>
      <Switch checked={checked} onCheckedChange={onChange} />
    </Field>
  );
}

function SelectControl({
  label,
  value,
  options,
  labels,
  compact = false,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  compact?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Field className="min-w-0">
      <FieldLabel
        className={compact ? 'md:sr-only md:!w-px md:!min-w-0' : undefined}
      >
        {label}
      </FieldLabel>
      <Select value={value} disabled={disabled} onValueChange={onChange}>
        <SelectTrigger className="w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {labels?.[option] ?? option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
