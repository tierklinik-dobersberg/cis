import { JwtPayload } from 'jwt-decode';

// Permission defines all API permissions.
export enum Permissions {
  CalllogCreateRecord = 'calllog:create',
  CalllogReadRecords = 'calllog:read',
  CommentCreate = 'comment:create',
  CommentRead = 'comment:read',
  CommentReply = 'comment:reply',
  CustomerRead = 'customer:read',
  SuggestionRead = 'suggestion:read',
  SuggestionApply = 'suggestion:apply',
  DoorGet = 'door:get',
  DoorSet = 'door:set',
  ExternalReadOnDuty = 'external:read-on-duty',
  ExternalReadContact = 'external:read-contact',
  ImportNeumayrContacts = 'import:neumayr-contacts',
  RosterWrite = 'roster:write',
  RosterRead = 'roster:read',
  RosterSetOverwrite = 'roster:write:overwrite',
  RosterGetOverwrite = 'roster:read:overwrite',
  VoicemailRead = 'voicemail:read',
  CalendarRead = 'calendar:events:read',
  CalendarWrite = 'calendar:events:write',
  CalendarDelete = 'calendar:events:delete',
  TriggerRead = 'trigger:read',
  TriggerExecute = 'trigger:execute',
  InfoScreenUploadFile = 'infoscreen:upload',
  InfoScreenShowsRead = 'infoscreen:show:read',
  InfoScreenShowWrite = 'infoscreen:show:write',
  InfoScreenShowDelete = 'infoscreen:show:delete',
}

export interface Permission {
  id: string;
  description: string;
  effect: 'allow' | 'deny';
  actions: string[];
  resources: string[];
  domain: string[];
}

export interface PermissionRequest {
  user?: string;
  resource?: string;
  action?: string;
}

export interface PermissionTestResult {
  allowed: boolean;
  message?: string;
  error?: string;
}

export interface TokenResponse {
  token: string;
}

export interface Token extends JwtPayload {
  expiresAt: Date;
  app_metadata: {
    authorization: {
      roles: string[];
    };
  };
}

/**
 * Profile describes a user profile stored and manage by CIS.
 */
export interface Profile {
  name: string;
  fullname: string;
  mail: string[];
  phoneNumbers: string[];
  roles: string[];
  properties: {
    [key: string]: any;
  };
  color?: string;
  disabled?: boolean;
  calendarID?: string;
  needsPasswordChange?: boolean;
}

export interface ProfileWithAvatar extends Profile {
  avatar?: string;
  color: string | null;
  fontColor: string | null;
}

export type UIPermissions = Partial<Record<Permissions, boolean>>;

export interface ProfileWithPermissions extends ProfileWithAvatar {
  permissions: UIPermissions;
}