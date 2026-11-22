// Shapes returned by the API routes (see api/chat and api/schemes).

export type RationCardCode = "PHH" | "NPHH" | "AAY" | "None";

export type Profile = {
  name?: string;
  age?: number;
  gender?: string;
  state?: string;
  district?: string;
  community?: string;
  income_annual?: number;
  ration_card?: RationCardCode;
  occupation?: string;
  medical_need?: string;
  education_need?: string;
  condition?: string;
  general_need?: string;
  detected_language?: string;
};

export type DynamicChip = {
  label: string;
  narrowing_keyword: string;
};

export type DynamicFollowup = {
  question: string;
  chips: DynamicChip[];
};

export type ChatApiResponse = {
  profile: Profile;
  conversational_response: string;
  search_terms: string[];
  dynamic_followup?: DynamicFollowup | null;
};

export type SchemeRow = {
  slug: string;
  scheme_name: string;
  short_title: string | null;
  level: string;
  state: string | null;
  brief_description: string | null;
  benefits?: string | null;
  scheme_close_date: string | null;
  dbt_scheme: boolean | null;
  benefit_type: string | null;
  categories?: string | null;
  tags?: string | null;
  eligibility?: string | null;
};

// Full scheme row used by the scheme detail page (/schemes/[slug]).
export type SchemeDetail = {
  slug: string;
  scheme_name: string;
  short_title: string | null;
  level: string;
  state: string | null;
  ministry: string | null;
  department: string | null;
  beneficiary_type: string | null;
  target_beneficiaries: string | null;
  benefit_type: string | null;
  categories: string[] | null;
  sub_categories: string[] | null;
  tags: string[] | null;
  brief_description: string | null;
  detailed_description: string | null;
  benefits: string | null;
  eligibility: string | null;
  exclusions: string | null;
  application_mode: string | null;
  application_process: string | null;
  documents_required: string | null;
  references: string | null;
  scheme_open_date: string | null;
  scheme_close_date: string | null;
  dbt_scheme: boolean | null;
  faq_count: number | null;
  source_url: string | null;
};

export type SchemeFaq = {
  scheme_slug: string;
  scheme_name: string;
  faq_number: number;
  question: string;
  answer: string;
};
