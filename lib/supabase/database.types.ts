export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      attendee_dates: {
        Row: {
          attendee_id: string;
          festival_date: string;
        };
        ComputedFields: never;
        Insert: {
          attendee_id: string;
          festival_date: string;
        };
        Update: {
          attendee_id?: string;
          festival_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'attendee_dates_attendee_id_fkey';
            columns: ['attendee_id'];
            isOneToOne: false;
            referencedRelation: 'attendees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendee_dates_festival_date_fkey';
            columns: ['festival_date'];
            isOneToOne: false;
            referencedRelation: 'festival_days';
            referencedColumns: ['festival_date'];
          },
        ];
      };
      attendees: {
        Row: {
          age: number;
          consent_at: string;
          consent_given: boolean;
          consent_text_version: string;
          created_at: string;
          email: string;
          full_name: string;
          gender: Database['public']['Enums']['gender_t'];
          id: string;
          location_area: string | null;
          location_city: string;
          mobile: string;
          pass_code: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          age: number;
          consent_at: string;
          consent_given: boolean;
          consent_text_version: string;
          created_at?: string;
          email: string;
          full_name: string;
          gender: Database['public']['Enums']['gender_t'];
          id?: string;
          location_area?: string | null;
          location_city: string;
          mobile: string;
          pass_code: string;
          updated_at?: string;
        };
        Update: {
          age?: number;
          consent_at?: string;
          consent_given?: boolean;
          consent_text_version?: string;
          created_at?: string;
          email?: string;
          full_name?: string;
          gender?: Database['public']['Enums']['gender_t'];
          id?: string;
          location_area?: string | null;
          location_city?: string;
          mobile?: string;
          pass_code?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: NonNullable<Json>;
          entity: string;
          entity_id: string | null;
          id: number;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          entity: string;
          entity_id?: string | null;
          id?: never;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          entity?: string;
          entity_id?: string | null;
          id?: never;
        };
        Relationships: [];
      };
      checkins: {
        Row: {
          attendee_id: string;
          checkin_at: string;
          checkin_date: string;
          client_ref: string | null;
          id: number;
          method: Database['public']['Enums']['checkin_method'];
          staff_id: string | null;
          synced_at: string;
        };
        ComputedFields: never;
        Insert: {
          attendee_id: string;
          checkin_at?: string;
          checkin_date: string;
          client_ref?: string | null;
          id?: never;
          method: Database['public']['Enums']['checkin_method'];
          staff_id?: string | null;
          synced_at?: string;
        };
        Update: {
          attendee_id?: string;
          checkin_at?: string;
          checkin_date?: string;
          client_ref?: string | null;
          id?: never;
          method?: Database['public']['Enums']['checkin_method'];
          staff_id?: string | null;
          synced_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'checkins_attendee_id_fkey';
            columns: ['attendee_id'];
            isOneToOne: false;
            referencedRelation: 'attendees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'checkins_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      draw_winners: {
        Row: {
          attendee_id: string;
          draw_id: number;
          position: number;
        };
        ComputedFields: never;
        Insert: {
          attendee_id: string;
          draw_id: number;
          position: number;
        };
        Update: {
          attendee_id?: string;
          draw_id?: number;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'draw_winners_attendee_id_fkey';
            columns: ['attendee_id'];
            isOneToOne: true;
            referencedRelation: 'attendees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'draw_winners_draw_id_fkey';
            columns: ['draw_id'];
            isOneToOne: false;
            referencedRelation: 'draws';
            referencedColumns: ['id'];
          },
        ];
      };
      draws: {
        Row: {
          draw_date: string;
          drawn_at: string;
          drawn_by: string | null;
          id: number;
          prize_note: string | null;
          published_at: string | null;
          winners_count: number;
        };
        ComputedFields: never;
        Insert: {
          draw_date: string;
          drawn_at?: string;
          drawn_by?: string | null;
          id?: never;
          prize_note?: string | null;
          published_at?: string | null;
          winners_count?: number;
        };
        Update: {
          draw_date?: string;
          drawn_at?: string;
          drawn_by?: string | null;
          id?: never;
          prize_note?: string | null;
          published_at?: string | null;
          winners_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'draws_drawn_by_fkey';
            columns: ['drawn_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      festival_days: {
        Row: {
          festival_date: string;
          id: number;
          is_active: boolean;
        };
        ComputedFields: never;
        Insert: {
          festival_date: string;
          id?: never;
          is_active?: boolean;
        };
        Update: {
          festival_date?: string;
          id?: never;
          is_active?: boolean;
        };
        Relationships: [];
      };
      key_people: {
        Row: {
          created_at: string;
          designation: string;
          display_order: number;
          festival_year: number;
          full_name: string;
          id: string;
          is_active: boolean;
          is_featured: boolean;
          organisation: string | null;
          photo_consent: boolean;
          photo_consent_at: string | null;
          photo_path: string | null;
          short_message: string | null;
          show_on: string[];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          designation: string;
          display_order?: number;
          festival_year: number;
          full_name: string;
          id?: string;
          is_active?: boolean;
          is_featured?: boolean;
          organisation?: string | null;
          photo_consent?: boolean;
          photo_consent_at?: string | null;
          photo_path?: string | null;
          short_message?: string | null;
          show_on?: string[];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          designation?: string;
          display_order?: number;
          festival_year?: number;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          is_featured?: boolean;
          organisation?: string | null;
          photo_consent?: boolean;
          photo_consent_at?: string | null;
          photo_path?: string | null;
          short_message?: string | null;
          show_on?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      partners: {
        Row: {
          banner_path: string | null;
          created_at: string;
          display_order: number;
          festival_year: number;
          id: string;
          is_active: boolean;
          logo_path: string;
          name: string;
          show_on: string[];
          tagline: string | null;
          tier: Database['public']['Enums']['partner_tier'];
          type: Database['public']['Enums']['partner_type'];
          updated_at: string;
          website_url: string | null;
        };
        ComputedFields: never;
        Insert: {
          banner_path?: string | null;
          created_at?: string;
          display_order?: number;
          festival_year: number;
          id?: string;
          is_active?: boolean;
          logo_path: string;
          name: string;
          show_on?: string[];
          tagline?: string | null;
          tier?: Database['public']['Enums']['partner_tier'];
          type: Database['public']['Enums']['partner_type'];
          updated_at?: string;
          website_url?: string | null;
        };
        Update: {
          banner_path?: string | null;
          created_at?: string;
          display_order?: number;
          festival_year?: number;
          id?: string;
          is_active?: boolean;
          logo_path?: string;
          name?: string;
          show_on?: string[];
          tagline?: string | null;
          tier?: Database['public']['Enums']['partner_tier'];
          type?: Database['public']['Enums']['partner_type'];
          updated_at?: string;
          website_url?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          role: Database['public']['Enums']['app_role'];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          full_name: string;
          id: string;
          is_active?: boolean;
          role?: Database['public']['Enums']['app_role'];
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          role?: Database['public']['Enums']['app_role'];
        };
        Relationships: [];
      };
      public_winner_entries: {
        Row: {
          attendee_id: string;
          draw_date: string;
          draw_id: number;
          first_name: string;
          masked_mobile: string;
          position: number;
        };
        ComputedFields: never;
        Insert: {
          attendee_id: string;
          draw_date: string;
          draw_id: number;
          first_name: string;
          masked_mobile: string;
          position: number;
        };
        Update: {
          attendee_id?: string;
          draw_date?: string;
          draw_id?: number;
          first_name?: string;
          masked_mobile?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'public_winner_entries_attendee_id_fkey';
            columns: ['attendee_id'];
            isOneToOne: false;
            referencedRelation: 'attendees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'public_winner_entries_draw_id_fkey';
            columns: ['draw_id'];
            isOneToOne: false;
            referencedRelation: 'draws';
            referencedColumns: ['id'];
          },
        ];
      };
      rate_limits: {
        Row: {
          hits: number;
          key: string;
          window_start: string;
        };
        ComputedFields: never;
        Insert: {
          hits?: number;
          key: string;
          window_start: string;
        };
        Update: {
          hits?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          consent_text_version: string;
          contact_email: string | null;
          daily_close_time: string;
          daily_open_time: string;
          draw_winners_per_day: number;
          end_date: string;
          festival_name: string;
          festival_year: number;
          id: number;
          privacy_text: string;
          registration_open: boolean;
          self_checkin_enabled: boolean;
          staff_limit: number;
          start_date: string;
          updated_at: string;
          venue: string;
        };
        ComputedFields: never;
        Insert: {
          consent_text_version?: string;
          contact_email?: string | null;
          daily_close_time: string;
          daily_open_time: string;
          draw_winners_per_day?: number;
          end_date: string;
          festival_name: string;
          festival_year: number;
          id?: number;
          privacy_text?: string;
          registration_open?: boolean;
          self_checkin_enabled?: boolean;
          staff_limit?: number;
          start_date: string;
          updated_at?: string;
          venue: string;
        };
        Update: {
          consent_text_version?: string;
          contact_email?: string | null;
          daily_close_time?: string;
          daily_open_time?: string;
          draw_winners_per_day?: number;
          end_date?: string;
          festival_name?: string;
          festival_year?: number;
          id?: number;
          privacy_text?: string;
          registration_open?: boolean;
          self_checkin_enabled?: boolean;
          staff_limit?: number;
          start_date?: string;
          updated_at?: string;
          venue?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      public_winners: {
        Row: {
          draw_date: string;
          first_name: string;
          masked_mobile: string;
          position: number;
        };
        ComputedFields: never;
        Insert: {
          draw_date?: string | null;
          first_name?: string | null;
          masked_mobile?: string | null;
          position?: number | null;
        };
        Update: {
          draw_date?: string | null;
          first_name?: string | null;
          masked_mobile?: string | null;
          position?: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      admin_attendee_count: {
        Args: {
          p_age_band?: string;
          p_city?: string;
          p_date?: string;
          p_gender?: Database['public']['Enums']['gender_t'];
          p_query?: string;
        };
        Returns: number;
      };
      admin_attendee_search: {
        Args: {
          p_after_created?: string;
          p_after_id?: string;
          p_age_band?: string;
          p_city?: string;
          p_date?: string;
          p_gender?: Database['public']['Enums']['gender_t'];
          p_limit?: number;
          p_query?: string;
        };
        Returns: {
          age: number;
          age_band: string;
          checkin_days: number;
          consent_at: string;
          consent_text_version: string;
          created_at: string;
          dates: string[];
          email: string;
          full_name: string;
          gender: Database['public']['Enums']['gender_t'];
          id: string;
          location_area: string;
          location_city: string;
          mobile: string;
          pass_code: string;
        }[];
      };
      admin_breakdown: {
        Args: { p_dimension: string };
        Returns: {
          attendees: number;
          checked_in: number;
          label: string;
        }[];
      };
      admin_checkin_log: {
        Args: {
          p_after_at?: string;
          p_after_id?: number;
          p_from?: string;
          p_limit?: number;
          p_to?: string;
        };
        Returns: {
          checkin_at: string;
          checkin_date: string;
          full_name: string;
          id: number;
          method: Database['public']['Enums']['checkin_method'];
          pass_code: string;
          staff_name: string;
        }[];
      };
      admin_checkins_by_staff: {
        Args: Record<PropertyKey, never>;
        Returns: {
          method: Database['public']['Enums']['checkin_method'];
          staff_id: string;
          staff_name: string;
          today: number;
          total: number;
        }[];
      };
      admin_daily_stats: {
        Args: Record<PropertyKey, never>;
        Returns: {
          actual: number;
          expected: number;
          festival_date: string;
          is_active: boolean;
          self_checkins: number;
          signups: number;
          staff_checkins: number;
        }[];
      };
      admin_dates_with_registrations_outside: {
        Args: { p_end: string; p_start: string };
        Returns: {
          festival_date: string;
          registrations: number;
        }[];
      };
      admin_delete_attendee: { Args: { p_attendee_id: string }; Returns: undefined };
      admin_kpis: {
        Args: Record<PropertyKey, never>;
        Returns: {
          conversion_rate: number;
          today_checkins: number;
          total_checkins: number;
          total_registrations: number;
          unique_attendees_checked_in: number;
        }[];
      };
      admin_publish_draw: {
        Args: { p_draw_id: number; p_prize_note?: string; p_publish: boolean };
        Returns: undefined;
      };
      admin_registrations_per_day: {
        Args: Record<PropertyKey, never>;
        Returns: {
          registrations: number;
          signup_date: string;
        }[];
      };
      admin_save_settings: { Args: { p: Json }; Returns: undefined };
      admin_winners: {
        Args: Record<PropertyKey, never>;
        Returns: {
          draw_date: string;
          draw_id: number;
          drawn_at: string;
          drawn_by_name: string;
          email: string;
          full_name: string;
          mobile: string;
          pass_code: string;
          position: number;
          prize_note: string;
          published: boolean;
        }[];
      };
      age_band: { Args: { p_age: number }; Returns: string };
      checkin: {
        Args: {
          p_attendee_id: string;
          p_client_ref?: string;
          p_method: Database['public']['Enums']['checkin_method'];
          p_scanned_at?: string;
          p_staff_id?: string;
        };
        Returns: {
          checkin_at: string;
          checkin_date: string;
          full_name: string;
          method: Database['public']['Enums']['checkin_method'];
          status: string;
        }[];
      };
      draw_eligible_count: { Args: { p_draw_date: string }; Returns: number };
      festival_today: { Args: Record<PropertyKey, never>; Returns: string };
      find_pass: {
        Args: { p_email: string; p_mobile: string; p_pass_code: string };
        Returns: string;
      };
      first_name: { Args: { p_full_name: string }; Returns: string };
      generate_pass_code: { Args: Record<PropertyKey, never>; Returns: string };
      get_pass: {
        Args: { p_attendee_id: string };
        Returns: {
          attendee_id: string;
          checked_in_at: string;
          checked_in_today: boolean;
          dates: string[];
          full_name: string;
          pass_code: string;
        }[];
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_service_role: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      log_audit: {
        Args: { p_action: string; p_details?: Json; p_entity: string; p_entity_id?: string };
        Returns: undefined;
      };
      mask_mobile: { Args: { p_mobile: string }; Returns: string };
      normalise_mobile: { Args: { p_input: string }; Returns: string };
      rate_limit_hit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      register_attendee: {
        Args: {
          p_age: number;
          p_area: string;
          p_city: string;
          p_consent: boolean;
          p_consent_version: string;
          p_dates: string[];
          p_email: string;
          p_full_name: string;
          p_gender: Database['public']['Enums']['gender_t'];
          p_mobile: string;
        };
        Returns: {
          added_dates: number;
          attendee_id: string;
          pass_code: string;
          status: string;
        }[];
      };
      run_daily_draw: {
        Args: { p_draw_date: string };
        Returns: {
          attendee_id: string;
          position: number;
        }[];
      };
      staff_lookup: {
        Args: { p_query: string };
        Returns: {
          attendee_id: string;
          checked_in_at: string;
          checked_in_today: boolean;
          dates: string[];
          full_name: string;
          masked_mobile: string;
          pass_code: string;
        }[];
      };
      staff_today_count: { Args: Record<PropertyKey, never>; Returns: number };
      write_audit: {
        Args: {
          p_action: string;
          p_actor: string;
          p_details: Json;
          p_entity: string;
          p_entity_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: 'admin' | 'staff';
      checkin_method: 'staff' | 'self';
      gender_t: 'male' | 'female' | 'other' | 'prefer_not_to_say';
      partner_tier: 'title' | 'platinum' | 'gold' | 'silver' | 'partner';
      partner_type: 'organiser' | 'sponsor';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ['admin', 'staff'],
      checkin_method: ['staff', 'self'],
      gender_t: ['male', 'female', 'other', 'prefer_not_to_say'],
      partner_tier: ['title', 'platinum', 'gold', 'silver', 'partner'],
      partner_type: ['organiser', 'sponsor'],
    },
  },
} as const;
