/**
 * Form Secretary - TypeScript Type Definitions
 */

export type MatchType = "smart" | "contains" | "exact" | "regex";
export type TargetProperty =
  "all" | "label" | "name" | "id" | "placeholder" | "aria";
export type ThemeMode = "light" | "dark" | "system";

export interface FormSecretaryField {
  id: string;
  label: string;
  value: string;
  pattern?: string;
  category: string;
  matchType: MatchType;
  targetProperty: TargetProperty;
  enabled: boolean;
  createdAt: number;
  updatedAt?: number;
}

export interface FormSecretarySettings {
  enabled: boolean;
  showInlineButtons: boolean;
  showFloatingBar: boolean;
  theme: ThemeMode;
  highlightFilledFields: boolean;
  enableContextMenu: boolean;
  maxCharsToHideTrigger: number;
}

export interface StorageDataBackup {
  version: string;
  exportedAt: string;
  categories: string[];
  fields: FormSecretaryField[];
  settings: FormSecretarySettings;
}

export interface FieldMetadata {
  element: HTMLElement;
  tag: string;
  type: string;
  name: string;
  rawName: string;
  id: string;
  rawId: string;
  placeholder: string;
  rawPlaceholder: string;
  ariaLabel: string;
  label: string;
  rawLabel: string;
  title: string;
  autocomplete: string;
  dataAttributes: string;
  combinedText: string;
  value: string;
  options?: string[];
}

export interface FieldMatchResult {
  matched: boolean;
  score: number;
  matchedBy: string;
}

export interface ScoredFieldMatch {
  field: FormSecretaryField;
  score: number;
  matchedBy: string;
}

export interface DetectedPageField {
  index: number;
  tag: string;
  type: string;
  name: string;
  rawName?: string;
  id: string;
  rawId?: string;
  label: string;
  rawLabel?: string;
  placeholder: string;
  rawPlaceholder?: string;
  currentValue: string;
  matchesCount: number;
  options?: string[];
  topMatch: {
    fieldId: string;
    label: string;
    value: string;
    score: number;
  } | null;
}


export interface MatchTypeConfigItem {
  desc: string;
  label: string;
  placeholder: string;
  help: string;
  isRegex: boolean;
}

export type MatchTypeConfig = Record<MatchType, MatchTypeConfigItem>;

export interface ExtensionMessageRequest {
  action:
    | "GET_PAGE_FIELDS"
    | "FILL_ALL_MATCHES"
    | "FILL_SPECIFIC_FIELD"
    | "REFRESH_FIELDS"
    | "FOCUS_FIELD";
  fieldIndex?: number;
  fieldName?: string;
  fieldId?: string;
  fieldLabel?: string;
  value?: string;
}


export interface ExtensionMessageResponse {
  success?: boolean;
  fields?: DetectedPageField[];
  count?: number;
}
