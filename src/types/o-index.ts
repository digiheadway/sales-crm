export type LeadStage =
  | 'Init - Fresh'
  | 'Init - Not Connected Yet'
  | 'Init - General Enquiry'
  | 'Mid - Exploring'
  | 'Mat - Follow Up'
  | 'Mat - In Pipeline'
  | 'Mat - In Closure'
  | 'Mat - Re Exploring'
  | 'Deal - Closed'
  | 'Neg - Low Bids'
  | 'Neg - Budget Issue'
  | 'Neg - Unrealistic'
  | 'Neg - Req Closed'
  | 'Neg - Invalid'
  | 'Neg - Lost'
  | 'Neg - Useless'
  | 'Other';

export type TodoType =
  | 'Follow Up'
  | 'Meeting'
  | 'Find Match'
  | 'Schedule Site Visit'
  | 'Todo'
  | 'Activity'
  | 'Other';

export type TodoStatus = 'Pending' | 'Completed' | 'Cancelled' | 'Overdue';


export type Priority = 'Super High' | 'High' | 'Focus' | 'General' | 'Low' | 'Avoid' | 'Never Attend';

export type Source =
  | 'Organic Social Media'
  | 'Youtube'
  | 'Referral'
  | 'GMB Others'
  | 'Website Others'
  | 'Our GMB'
  | 'Website'
  | 'M3M'
  | 'Trident'
  | 'Dealer Network'
  | 'Social Media'
  | 'Cold Call'
  | 'Olx'
  | 'Offline Meet'
  | 'Property DB'
  | 'Shoping'
  | 'Other'
  | 'Groups'
  | 'Ads Display'
  | 'Ads Search'
  | 'Many Chats'
  | 'Listings'
  | 'Physical World'
  | 'Holdings'
  | 'Other Organic Display'
  | 'Other Organic Search';



export type NextAction =
  | 'Call Back'
  | 'Site Visit'
  | 'Follow Up'
  | 'Meeting'
  | 'Other';

export type Segment =
  | 'Panipat'
  | 'Panipat Projects'
  | 'Panipat Investors'
  | 'Rohtak'
  | 'Sonipat'
  | 'Sigma'
  | 'Trident'
  | 'Godrej'
  | 'M3M';

export type Purpose = 'Self Use' | 'Investment' | 'Rental' | 'Resale' | 'Other';

export interface Lead {
  id: number;
  isInPipeline: boolean;
  name: string;
  phone: string;
  alternatePhone?: string;
  address?: string;
  labels: string[];
  stage: LeadStage;
  priority: Priority;
  requirement?: string;
  budget: number;
  about?: string;
  note?: string;
  listName?: string;
  source: Source;
  customFields?: {
    family?: string;
    visited?: string;
    [key: string]: any;
  };
  type: string;
  assignedTo: string;
  adminId: number;
  email?: string;
  leadScore: number;
  lastNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Todo {
  id: number;
  leadId: number;
  type: TodoType;
  description?: string;
  responseNote?: string;
  status: TodoStatus;
  dateTime: string;
  participants: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TagOption {
  value: string;
  label: string;
}

export interface DropdownOption {
  value: string;
  label: string;
  searchable?: boolean;
}

export interface FilterOption {
  field: string;
  operator: string;
  value: string | number | string[];
}
