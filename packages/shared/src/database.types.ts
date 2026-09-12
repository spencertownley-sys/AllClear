/**
 * Hand-maintained Supabase `Database` type mirroring supabase/migrations.
 * Regenerate with `supabase gen types typescript --local` once a project is linked,
 * and keep this file in sync.
 */
import type { WeatherCurrent, WeatherDaily, WeatherHourly } from './types';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      watch_locations: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          latitude: number;
          longitude: number;
          city_name: string | null;
          state: string | null;
          postal_code: string | null;
          country: string;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label: string;
          latitude: number;
          longitude: number;
          city_name?: string | null;
          state?: string | null;
          postal_code?: string | null;
          country?: string;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          label?: string;
          latitude?: number;
          longitude?: number;
          city_name?: string | null;
          state?: string | null;
          postal_code?: string | null;
          country?: string;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      location_layers: {
        Row: {
          id: string;
          watch_location_id: string;
          layer_type: Database['public']['Enums']['layer_type'];
          enabled: boolean;
          radius_miles: number | null;
          min_magnitude: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          watch_location_id: string;
          layer_type: Database['public']['Enums']['layer_type'];
          enabled?: boolean;
          radius_miles?: number | null;
          min_magnitude?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          watch_location_id?: string;
          layer_type?: Database['public']['Enums']['layer_type'];
          enabled?: boolean;
          radius_miles?: number | null;
          min_magnitude?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'location_layers_watch_location_id_fkey';
            columns: ['watch_location_id'];
            isOneToOne: false;
            referencedRelation: 'watch_locations';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_rules: {
        Row: {
          id: string;
          watch_location_id: string;
          layer_type: Database['public']['Enums']['notification_layer_type'];
          condition_type: Database['public']['Enums']['condition_type'];
          threshold_value: number | null;
          channel: Database['public']['Enums']['notification_channel'];
          enabled: boolean;
          min_interval_minutes: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          watch_location_id: string;
          layer_type: Database['public']['Enums']['notification_layer_type'];
          condition_type: Database['public']['Enums']['condition_type'];
          threshold_value?: number | null;
          channel?: Database['public']['Enums']['notification_channel'];
          enabled?: boolean;
          min_interval_minutes?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          watch_location_id?: string;
          layer_type?: Database['public']['Enums']['notification_layer_type'];
          condition_type?: Database['public']['Enums']['condition_type'];
          threshold_value?: number | null;
          channel?: Database['public']['Enums']['notification_channel'];
          enabled?: boolean;
          min_interval_minutes?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_rules_watch_location_id_fkey';
            columns: ['watch_location_id'];
            isOneToOne: false;
            referencedRelation: 'watch_locations';
            referencedColumns: ['id'];
          },
        ];
      };
      cached_hazard_events: {
        Row: {
          id: string;
          source: Database['public']['Enums']['hazard_source'];
          external_id: string;
          event_type: string;
          title: string;
          description: string | null;
          severity: string | null;
          latitude: number | null;
          longitude: number | null;
          geometry: unknown | null;
          magnitude: number | null;
          aqi: number | null;
          occurred_at: string | null;
          attributes: Json;
          raw_payload: Json;
          fetched_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          source: Database['public']['Enums']['hazard_source'];
          external_id: string;
          event_type: string;
          title: string;
          description?: string | null;
          severity?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          geometry?: unknown | null;
          magnitude?: number | null;
          aqi?: number | null;
          occurred_at?: string | null;
          attributes?: Json;
          raw_payload?: Json;
          fetched_at?: string;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          source?: Database['public']['Enums']['hazard_source'];
          external_id?: string;
          event_type?: string;
          title?: string;
          description?: string | null;
          severity?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          geometry?: unknown | null;
          magnitude?: number | null;
          aqi?: number | null;
          occurred_at?: string | null;
          attributes?: Json;
          raw_payload?: Json;
          fetched_at?: string;
          expires_at?: string | null;
        };
        Relationships: [];
      };
      cached_weather: {
        Row: {
          id: string;
          grid_key: string;
          latitude: number;
          longitude: number;
          city_name: string | null;
          state: string | null;
          time_zone: string | null;
          current: WeatherCurrent | null;
          hourly: WeatherHourly[];
          daily: WeatherDaily[];
          source: Database['public']['Enums']['hazard_source'];
          fetched_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          grid_key: string;
          latitude: number;
          longitude: number;
          city_name?: string | null;
          state?: string | null;
          time_zone?: string | null;
          current?: WeatherCurrent | null;
          hourly?: WeatherHourly[];
          daily?: WeatherDaily[];
          source?: Database['public']['Enums']['hazard_source'];
          fetched_at?: string;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          grid_key?: string;
          latitude?: number;
          longitude?: number;
          city_name?: string | null;
          state?: string | null;
          time_zone?: string | null;
          current?: WeatherCurrent | null;
          hourly?: WeatherHourly[];
          daily?: WeatherDaily[];
          source?: Database['public']['Enums']['hazard_source'];
          fetched_at?: string;
          expires_at?: string | null;
        };
        Relationships: [];
      };
      notifications_log: {
        Row: {
          id: string;
          user_id: string;
          watch_location_id: string | null;
          notification_rule_id: string | null;
          hazard_event_id: string | null;
          layer_type: Database['public']['Enums']['notification_layer_type'] | null;
          summary: string;
          channel: Database['public']['Enums']['delivery_channel'];
          sent_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          watch_location_id?: string | null;
          notification_rule_id?: string | null;
          hazard_event_id?: string | null;
          layer_type?: Database['public']['Enums']['notification_layer_type'] | null;
          summary: string;
          channel: Database['public']['Enums']['delivery_channel'];
          sent_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          watch_location_id?: string | null;
          notification_rule_id?: string | null;
          hazard_event_id?: string | null;
          layer_type?: Database['public']['Enums']['notification_layer_type'] | null;
          summary?: string;
          channel?: Database['public']['Enums']['delivery_channel'];
          sent_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_log_watch_location_id_fkey';
            columns: ['watch_location_id'];
            isOneToOne: false;
            referencedRelation: 'watch_locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_log_notification_rule_id_fkey';
            columns: ['notification_rule_id'];
            isOneToOne: false;
            referencedRelation: 'notification_rules';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_log_hazard_event_id_fkey';
            columns: ['hazard_event_id'];
            isOneToOne: false;
            referencedRelation: 'cached_hazard_events';
            referencedColumns: ['id'];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
          last_used_at: string | null;
          failure_count: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
          last_used_at?: string | null;
          failure_count?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          created_at?: string;
          last_used_at?: string | null;
          failure_count?: number;
        };
        Relationships: [];
      };
      poller_runs: {
        Row: {
          id: number;
          source: string;
          started_at: string;
          finished_at: string | null;
          status: string;
          rows_upserted: number;
          error: string | null;
          details: Json;
        };
        Insert: {
          id?: number;
          source: string;
          started_at?: string;
          finished_at?: string | null;
          status: string;
          rows_upserted?: number;
          error?: string | null;
          details?: Json;
        };
        Update: {
          id?: number;
          source?: string;
          started_at?: string;
          finished_at?: string | null;
          status?: string;
          rows_upserted?: number;
          error?: string | null;
          details?: Json;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      hazards_near: {
        Args: {
          p_lat: number;
          p_lng: number;
          p_radius_miles: number;
          p_event_types: string[];
          p_limit?: number;
        };
        Returns: Array<{
          id: string;
          source: Database['public']['Enums']['hazard_source'];
          external_id: string;
          event_type: string;
          title: string;
          description: string | null;
          severity: string | null;
          latitude: number | null;
          longitude: number | null;
          magnitude: number | null;
          aqi: number | null;
          occurred_at: string | null;
          attributes: Json;
          fetched_at: string;
          expires_at: string | null;
          distance_miles: number;
        }>;
      };
      alerts_for_point: {
        Args: { p_lat: number; p_lng: number };
        Returns: Array<{
          id: string;
          source: Database['public']['Enums']['hazard_source'];
          external_id: string;
          event_type: string;
          title: string;
          description: string | null;
          severity: string | null;
          latitude: number | null;
          longitude: number | null;
          magnitude: number | null;
          aqi: number | null;
          occurred_at: string | null;
          attributes: Json;
          fetched_at: string;
          expires_at: string | null;
          distance_miles: number;
        }>;
      };
      hazards_in_bbox: {
        Args: {
          p_min_lng: number;
          p_min_lat: number;
          p_max_lng: number;
          p_max_lat: number;
          p_event_types: string[];
          p_limit?: number;
        };
        Returns: Array<{
          id: string;
          source: Database['public']['Enums']['hazard_source'];
          event_type: string;
          title: string;
          severity: string | null;
          latitude: number;
          longitude: number;
          magnitude: number | null;
          occurred_at: string | null;
          attributes: Json;
          fetched_at: string;
        }>;
      };
      nearest_weather: {
        Args: { p_lat: number; p_lng: number; p_max_miles?: number };
        Returns: Array<{
          id: string;
          grid_key: string;
          latitude: number;
          longitude: number;
          city_name: string | null;
          state: string | null;
          time_zone: string | null;
          current: WeatherCurrent | null;
          hourly: WeatherHourly[];
          daily: WeatherDaily[];
          source: Database['public']['Enums']['hazard_source'];
          fetched_at: string;
          expires_at: string | null;
          distance_miles: number;
        }>;
      };
      dashboard_summary: {
        Args: Record<string, never>;
        Returns: Array<{
          location_id: string;
          fire_count: number;
          incident_count: number;
          quake_count: number;
          max_quake_magnitude: number | null;
          aqi: number | null;
          alert_count: number;
          top_alert_event: string | null;
          top_alert_severity: string | null;
          weather_current: WeatherCurrent | null;
          weather_fetched_at: string | null;
        }>;
      };
      perimeters_near: {
        Args: {
          p_lat: number;
          p_lng: number;
          p_radius_miles: number;
          p_event_types: string[];
          p_limit?: number;
        };
        Returns: Array<{
          id: string;
          source: Database['public']['Enums']['hazard_source'];
          external_id: string;
          event_type: string;
          title: string;
          severity: string | null;
          occurred_at: string | null;
          attributes: Json;
          fetched_at: string;
          expires_at: string | null;
          distance_miles: number;
          geojson: Json;
        }>;
      };
      hazard_polygons_in_bbox: {
        Args: {
          p_min_lng: number;
          p_min_lat: number;
          p_max_lng: number;
          p_max_lat: number;
          p_event_types: string[];
          p_limit?: number;
        };
        Returns: Array<{
          id: string;
          source: Database['public']['Enums']['hazard_source'];
          event_type: string;
          title: string;
          attributes: Json;
          fetched_at: string;
          geojson: Json;
        }>;
      };
      latest_source_freshness: {
        Args: Record<string, never>;
        Returns: Array<{ source: string; last_success_at: string | null; last_status: string | null }>;
      };
    };
    Enums: {
      layer_type: 'weather' | 'wildfire' | 'earthquake' | 'air_quality';
      notification_layer_type: 'weather' | 'wildfire' | 'earthquake' | 'air_quality' | 'official_alerts';
      condition_type: 'distance_threshold_miles' | 'magnitude_threshold' | 'aqi_threshold' | 'any_active';
      notification_channel: 'web_push' | 'email' | 'both';
      delivery_channel: 'web_push' | 'email';
      hazard_source: 'nws' | 'firms' | 'inciweb' | 'usgs' | 'airnow' | 'epa' | 'nhc';
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
