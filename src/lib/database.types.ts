export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type StaffRole = 'Server' | 'Bartender' | 'Host';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: 'super_admin' | 'admin' | 'staff';
          org_id: string | null;
          staff_role: StaffRole | null;
          rating: number;
          status: 'active' | 'inactive';
          is_validated: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: 'super_admin' | 'admin' | 'staff';
          org_id?: string | null;
          staff_role?: StaffRole | null;
          rating?: number;
          status?: 'active' | 'inactive';
          is_validated?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: 'super_admin' | 'admin' | 'staff';
          org_id?: string | null;
          staff_role?: StaffRole | null;
          rating?: number;
          status?: 'active' | 'inactive';
          is_validated?: boolean;
          created_at?: string;
        };
      };
      events: {
        Row: {
          id: string;
          title: string;
          event_date: string;
          venue: string;
          dress_code: string;
          open_shifts: number;
          role_required: StaffRole;
          start_time: string;
          end_time: string;
          hourly_rate: number | null;
          uniform_requirements: string | null;
          description: string | null;
          created_by: string | null;
          org_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          event_date: string;
          venue: string;
          dress_code: string;
          open_shifts?: number;
          role_required?: StaffRole;
          start_time?: string;
          end_time?: string;
          hourly_rate?: number | null;
          uniform_requirements?: string | null;
          description?: string | null;
          created_by?: string | null;
          org_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          event_date?: string;
          venue?: string;
          dress_code?: string;
          open_shifts?: number;
          role_required?: StaffRole;
          start_time?: string;
          end_time?: string;
          hourly_rate?: number | null;
          uniform_requirements?: string | null;
          description?: string | null;
          created_by?: string | null;
          org_id?: string | null;
          created_at?: string;
        };
      };
      organizations: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          logo_url: string | null;
          primary_color: string | null;
          billing_status: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          logo_url?: string | null;
          primary_color?: string | null;
          billing_status?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          logo_url?: string | null;
          primary_color?: string | null;
          billing_status?: string | null;
          created_at?: string;
        };
      };
      shift_requests: {
        Row: {
          id: string;
          event_id: string;
          staff_id: string;
          status: 'confirmed' | 'pending' | 'rejected';
          requested_at: string;
          approved_at: string | null;
          approved_by: string | null;
          check_in_signature: string | null;
          check_in_time: string | null;
          check_out_signature: string | null;
          check_out_time: string | null;
          uniform_verified: boolean;
          uniform_verified_by: string | null;
          uniform_verified_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          staff_id: string;
          status?: 'confirmed' | 'pending' | 'rejected';
          requested_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          check_in_signature?: string | null;
          check_in_time?: string | null;
          check_out_signature?: string | null;
          check_out_time?: string | null;
          uniform_verified?: boolean;
          uniform_verified_by?: string | null;
          uniform_verified_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          staff_id?: string;
          status?: 'confirmed' | 'pending' | 'rejected';
          requested_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          check_in_signature?: string | null;
          check_in_time?: string | null;
          check_out_signature?: string | null;
          check_out_time?: string | null;
          uniform_verified?: boolean;
          uniform_verified_by?: string | null;
          uniform_verified_at?: string | null;
        };
      };
    };
  };
}
