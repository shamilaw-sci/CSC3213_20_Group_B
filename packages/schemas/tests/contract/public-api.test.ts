import { describe, expect, it } from 'bun:test';

import type {
  ApiErrorEnvelope,
  MutationAccepted,
  MutationControl,
  OperationStatusResponse,
  Page,
  PaginationRequest,
} from '#index';
import * as publicApi from '#index';

function acceptsPublicApiTypes(_contracts: {
  error: ApiErrorEnvelope;
  mutation: MutationControl;
  accepted: MutationAccepted;
  operation: OperationStatusResponse;
  request: PaginationRequest;
  page: Page<{ id: string }>;
}): void {}

const expectedRuntimeExports = [
  'ApiErrorCodeSchema',
  'ApiErrorEnvelopeSchema',
  'ApiErrorSchema',
  'AcademicDepartmentCodeSchema',
  'AcademicDepartmentSchema',
  'AcademicPeriodSchema',
  'AcademicRankSchema',
  'AcademicSubjectDepartmentMap',
  'AcademicSubjectCodeSchema',
  'AcademicSubjectSelectionSchema',
  'AcademicSubjectSchema',
  'AcademicSupportPositionSchema',
  'AcademicSupportStaffSchema',
  'AcademicTeachingStaffSchema',
  'AcademicUnitCodeSchema',
  'AcademicUnitSchema',
  'AcademicUsernameSchema',
  'AcademicYearSchema',
  'AlumniBatchListSchema',
  'AlumniBatchSchema',
  'ConferenceSchema',
  'ConflictDetailsSchema',
  'CorrelationIdSchema',
  'CourseCodeSchema',
  'CourseIdSchema',
  'CourseOfferingIdSchema',
  'CourseOfferingSchema',
  'CourseSchema',
  'CourseStaffSchema',
  'EntityRevisionSchema',
  'FacultyCodeSchema',
  'HonoursProgrammeDepartmentMap',
  'HonoursStreamSchema',
  'HonoursProgrammeCodeSchema',
  'IdempotencyKeySchema',
  'KnownSocialIcons',
  'KnownSocialPlatforms',
  'MailerSendRequestSchema',
  'NonAcademicPositionSchema',
  'NonAcademicStaffSchema',
  'OpaqueCursorSchema',
  'OperationActorSchema',
  'OperationIdSchema',
  'OperationOutcomeSchema',
  'OperationResourceSchema',
  'OperationResourceTypeSchema',
  'OperationStatusResponseSchema',
  'OperationStatusSchema',
  'PageInfoSchema',
  'PageLimitSchema',
  'PaginationRequestSchema',
  'PeopleSearchEntrySchema',
  'PeopleSearchEntryTypeSchema',
  'PeopleSearchIndexSchema',
  'PersonSchema',
  'PostgraduateProgrammeDefinitionListSchema',
  'PostgraduateProgrammeDefinitionSchema',
  'PostgraduateProgrammeSchema',
  'PrincipalSubjectArea1000LevelCodes',
  'ProgramSchema',
  'ProjectCourseOfferingSchema',
  'ProjectCourseSchema',
  'ProjectDatesSchema',
  'ProjectLinksSchema',
  'ProjectMediaSchema',
  'ProjectPersonRoleSchema',
  'ProjectPersonSchema',
  'ProjectSchema',
  'ProjectSourceSchema',
  'ProjectStatusSchema',
  'ProjectTypeSchema',
  'PublicationSchema',
  'ResearchSchema',
  'SNumberSchema',
  'SlqfLevelSchema',
  'SocialIconSchema',
  'SocialLinksSchema',
  'SpecialDegreeSubjectCodes',
  'StaffSchema',
  'ScienceAcademicDepartments',
  'ScienceAcademicSubjects',
  'ScienceAcademicUnits',
  'StudentLevelSchema',
  'StudentPlacementListSchema',
  'StudentPlacementSchema',
  'StudentSchema',
  'StudentStatusSchema',
  'StudentStreamDefinitionListSchema',
  'StudentStreamDefinitionSchema',
  'StudentStreamSchema',
  'StudentTrackSchema',
  'StudentTypeSchema',
  'UpperLevelSubjectCodes',
  'MutationAcceptedSchema',
  'MutationControlSchema',
  'createPageSchema',
  'detectKnownSocialUrl',
  'normalizeKnownSocialUrl',
] as const satisfies readonly (keyof typeof publicApi)[];

describe('package public API', () => {
  it('exports the API contract types', () => {
    expect(acceptsPublicApiTypes).toBeFunction();
  });

  for (const exportName of expectedRuntimeExports) {
    it(`exports ${exportName}`, () => {
      expect(publicApi[exportName]).toBeDefined();
    });
  }

  it('does not expose an unexpected runtime contract', () => {
    expect(Object.keys(publicApi).sort()).toEqual(
      [...expectedRuntimeExports].sort()
    );
  });
});
