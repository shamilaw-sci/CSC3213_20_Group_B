export interface AdminActionDefinition {
  id: string;
  title: string;
  description: string;
  method: 'POST';
  href: string;
  danger: boolean;
  confirmation: string;
  requestSchema: {
    type: 'object';
    properties?: Record<
      string,
      {
        type?: string;
        enum?: string[];
        default?: string;
        description?: string;
      }
    >;
    required?: string[];
    additionalProperties?: boolean;
  };
  resultSchema: Record<string, unknown>;
}

export interface AdminActionsResponse {
  schemaVersion: number;
  actions: AdminActionDefinition[];
}
