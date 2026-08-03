// Formatos que a Google Meet REST API v2 devolve.
//
// Só os campos que usamos. A API manda bem mais, mas declarar o que não se lê
// só cria ilusão de contrato.

export type AutoGeneration = "ON" | "OFF";

export interface MeetArtifactConfig {
  recordingConfig?: { autoRecordingGeneration?: AutoGeneration };
  transcriptionConfig?: { autoTranscriptionGeneration?: AutoGeneration };
  smartNotesConfig?: { autoSmartNotesGeneration?: AutoGeneration };
}

export interface MeetSpaceConfig {
  accessType?: "ACCESS_TYPE_UNSPECIFIED" | "OPEN" | "TRUSTED" | "RESTRICTED";
  entryPointAccess?: "ALL" | "CREATOR_APP_ONLY";
  artifactConfig?: MeetArtifactConfig;
}

export interface MeetSpace {
  name: string; // "spaces/AbCdEf"
  meetingUri?: string;
  meetingCode?: string;
  config?: MeetSpaceConfig;
}

export interface MeetConferenceRecord {
  name: string; // "conferenceRecords/xyz"
  startTime: string;
  endTime?: string; // ausente enquanto a conferência está em curso
  expireTime?: string;
  space: string; // "spaces/AbCdEf"
}

export interface MeetParticipant {
  name: string; // "conferenceRecords/xyz/participants/123"
  earliestStartTime?: string;
  latestEndTime?: string;
  signedinUser?: { user?: string; displayName?: string };
  anonymousUser?: { displayName?: string };
  phoneUser?: { displayName?: string };
}

export interface MeetParticipantSession {
  name: string;
  startTime?: string;
  endTime?: string; // null enquanto a pessoa está na sala
}

export interface MeetTranscript {
  name: string; // "conferenceRecords/xyz/transcripts/abc"
  state?: string;
  docsDestination?: { document?: string; exportUri?: string };
  startTime?: string;
  endTime?: string;
}

export interface MeetTranscriptEntry {
  name: string;
  participant?: string; // aponta para o participant
  text?: string; // NÃO é persistido; só serve pra contar turno
  languageCode?: string;
  startTime?: string;
  endTime?: string;
}

export interface MeetRecording {
  name: string;
  state?: string;
  driveDestination?: { file?: string; exportUri?: string };
  startTime?: string;
  endTime?: string;
}

/** Config de artefatos no formato do nosso banco. */
export interface ArtefatosDesejados {
  gravar: boolean;
  transcrever: boolean;
  notas: boolean;
}

export type AccessType = "OPEN" | "TRUSTED" | "RESTRICTED";
