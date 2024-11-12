export interface Job {
  id: number;
  updated_time: string;
  title: string;
  contents: string;
  '1depth_region': string;
  '2depth_region': string;
  '1depth_category': string;
  '2depth_category': string;
  ad: boolean;
}

export interface AdJob extends Job {
  ad: true;
} 