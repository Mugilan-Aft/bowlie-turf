export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      add_on_services: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price: number
          turf_id: string
          unit: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
          turf_id: string
          unit?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          turf_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "add_on_services_turf_id_fkey"
            columns: ["turf_id"]
            isOneToOne: false
            referencedRelation: "turfs"
            referencedColumns: ["id"]
          },
        ]
      }
      amenities: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          title: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          title: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          title?: string
        }
        Relationships: []
      }
      availability_slots: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_peak: boolean
          pitch_type_id: string | null
          price: number
          start_time: string
          turf_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_peak?: boolean
          pitch_type_id?: string | null
          price: number
          start_time: string
          turf_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_peak?: boolean
          pitch_type_id?: string | null
          price?: number
          start_time?: string
          turf_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_slots_pitch_type_id_fkey"
            columns: ["pitch_type_id"]
            isOneToOne: false
            referencedRelation: "pitch_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_slots_turf_id_fkey"
            columns: ["turf_id"]
            isOneToOne: false
            referencedRelation: "turfs"
            referencedColumns: ["id"]
          },
        ]
      }
      blackout_periods: {
        Row: {
          created_at: string
          end_at: string
          id: string
          pitch_type_id: string | null
          reason: string | null
          start_at: string
          turf_id: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          pitch_type_id?: string | null
          reason?: string | null
          start_at: string
          turf_id: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          pitch_type_id?: string | null
          reason?: string | null
          start_at?: string
          turf_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blackout_periods_pitch_type_id_fkey"
            columns: ["pitch_type_id"]
            isOneToOne: false
            referencedRelation: "pitch_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blackout_periods_turf_id_fkey"
            columns: ["turf_id"]
            isOneToOne: false
            referencedRelation: "turfs"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_add_ons: {
        Row: {
          add_on_id: string
          booking_id: string
          id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          add_on_id: string
          booking_id: string
          id?: string
          quantity?: number
          unit_price: number
        }
        Update: {
          add_on_id?: string
          booking_id?: string
          id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_add_ons_add_on_id_fkey"
            columns: ["add_on_id"]
            isOneToOne: false
            referencedRelation: "add_on_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_add_ons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_participants: {
        Row: {
          booking_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          booking_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          booking_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_participants_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_status_events: {
        Row: {
          booking_id: string
          changed_by: string | null
          created_at: string
          from_payment_status:
            | Database["public"]["Enums"]["payment_status"]
            | null
          from_status: Database["public"]["Enums"]["booking_status"] | null
          id: string
          note: string | null
          to_payment_status:
            | Database["public"]["Enums"]["payment_status"]
            | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          booking_id: string
          changed_by?: string | null
          created_at?: string
          from_payment_status?:
            | Database["public"]["Enums"]["payment_status"]
            | null
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          note?: string | null
          to_payment_status?:
            | Database["public"]["Enums"]["payment_status"]
            | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          booking_id?: string
          changed_by?: string | null
          created_at?: string
          from_payment_status?:
            | Database["public"]["Enums"]["payment_status"]
            | null
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          note?: string | null
          to_payment_status?:
            | Database["public"]["Enums"]["payment_status"]
            | null
          to_status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "booking_status_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          add_ons_amount: number
          cancellation_reason: string | null
          cancelled_at: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          currency: string
          end_at: string
          id: string
          is_offline: boolean
          lock_expires_at: string | null
          notes: string | null
          offline_customer_name: string | null
          offline_customer_phone: string | null
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pitch_type_id: string | null
          rescheduled_from_id: string | null
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          subtotal_amount: number
          total_amount: number
          turf_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          add_ons_amount?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          currency?: string
          end_at: string
          id?: string
          is_offline?: boolean
          lock_expires_at?: string | null
          notes?: string | null
          offline_customer_name?: string | null
          offline_customer_phone?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pitch_type_id?: string | null
          rescheduled_from_id?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal_amount?: number
          total_amount?: number
          turf_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          add_ons_amount?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          currency?: string
          end_at?: string
          id?: string
          is_offline?: boolean
          lock_expires_at?: string | null
          notes?: string | null
          offline_customer_name?: string | null
          offline_customer_phone?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pitch_type_id?: string | null
          rescheduled_from_id?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal_amount?: number
          total_amount?: number
          turf_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_pitch_type_id_fkey"
            columns: ["pitch_type_id"]
            isOneToOne: false
            referencedRelation: "pitch_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_rescheduled_from_id_fkey"
            columns: ["rescheduled_from_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_turf_id_fkey"
            columns: ["turf_id"]
            isOneToOne: false
            referencedRelation: "turfs"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          turf_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          turf_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          turf_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_turf_id_fkey"
            columns: ["turf_id"]
            isOneToOne: false
            referencedRelation: "turfs"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture_score_events: {
        Row: {
          created_at: string
          created_by: string | null
          fixture_id: string
          id: string
          note: string | null
          score_a: number | null
          score_b: number | null
          status: string | null
          tournament_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fixture_id: string
          id?: string
          note?: string | null
          score_a?: number | null
          score_b?: number | null
          status?: string | null
          tournament_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fixture_id?: string
          id?: string
          note?: string | null
          score_a?: number | null
          score_b?: number | null
          status?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixture_score_events_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "tournament_fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_score_events_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      live_matches: {
        Row: {
          booking_id: string | null
          created_at: string
          ended_at: string | null
          id: string
          score_a: number
          score_b: number
          sport_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["match_status"]
          team_a: string
          team_b: string
          tournament_id: string | null
          turf_id: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          score_a?: number
          score_b?: number
          sport_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          team_a: string
          team_b: string
          tournament_id?: string | null
          turf_id?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          score_a?: number
          score_b?: number
          sport_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          team_a?: string
          team_b?: string
          tournament_id?: string | null
          turf_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_matches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_matches_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_matches_turf_id_fkey"
            columns: ["turf_id"]
            isOneToOne: false
            referencedRelation: "turfs"
            referencedColumns: ["id"]
          },
        ]
      }
      live_score_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          match_id: string
          payload: Json
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          match_id: string
          payload?: Json
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          match_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "live_score_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "live_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          currency: string
          id: string
          owner_payout_status: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_ref: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          currency?: string
          id?: string
          owner_payout_status?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          currency?: string
          id?: string
          owner_payout_status?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_types: {
        Row: {
          base_price: number
          capacity: number | null
          created_at: string
          id: string
          name: string
          surface_type: string | null
          turf_id: string
        }
        Insert: {
          base_price?: number
          capacity?: number | null
          created_at?: string
          id?: string
          name: string
          surface_type?: string | null
          turf_id: string
        }
        Update: {
          base_price?: number
          capacity?: number | null
          created_at?: string
          id?: string
          name?: string
          surface_type?: string | null
          turf_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pitch_types_turf_id_fkey"
            columns: ["turf_id"]
            isOneToOne: false
            referencedRelation: "turfs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          ban_reason: string | null
          banned_at: string | null
          bio: string | null
          city: string | null
          created_at: string
          full_name: string | null
          id: string
          is_banned: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_banned?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_banned?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          turf_id: string
          user_id: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          turf_id: string
          user_id: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          turf_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_turf_id_fkey"
            columns: ["turf_id"]
            isOneToOne: false
            referencedRelation: "turfs"
            referencedColumns: ["id"]
          },
        ]
      }
      sports: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      squad_fill_posts: {
        Row: {
          approval_mode: Database["public"]["Enums"]["approval_mode"]
          booking_id: string
          created_at: string
          emergency_expires_at: string | null
          fill_type: Database["public"]["Enums"]["squad_fill_type"]
          host_id: string
          id: string
          join_fee: number
          notes: string | null
          skill_level: Database["public"]["Enums"]["skill_level"]
          sport_id: string | null
          spots_filled: number
          spots_needed: number
          status: Database["public"]["Enums"]["squad_post_status"]
        }
        Insert: {
          approval_mode?: Database["public"]["Enums"]["approval_mode"]
          booking_id: string
          created_at?: string
          emergency_expires_at?: string | null
          fill_type?: Database["public"]["Enums"]["squad_fill_type"]
          host_id: string
          id?: string
          join_fee?: number
          notes?: string | null
          skill_level?: Database["public"]["Enums"]["skill_level"]
          sport_id?: string | null
          spots_filled?: number
          spots_needed: number
          status?: Database["public"]["Enums"]["squad_post_status"]
        }
        Update: {
          approval_mode?: Database["public"]["Enums"]["approval_mode"]
          booking_id?: string
          created_at?: string
          emergency_expires_at?: string | null
          fill_type?: Database["public"]["Enums"]["squad_fill_type"]
          host_id?: string
          id?: string
          join_fee?: number
          notes?: string | null
          skill_level?: Database["public"]["Enums"]["skill_level"]
          sport_id?: string | null
          spots_filled?: number
          spots_needed?: number
          status?: Database["public"]["Enums"]["squad_post_status"]
        }
        Relationships: [
          {
            foreignKeyName: "squad_fill_posts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_fill_posts_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_fill_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          post_id: string
          status: Database["public"]["Enums"]["squad_request_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          post_id: string
          status?: Database["public"]["Enums"]["squad_request_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          post_id?: string
          status?: Database["public"]["Enums"]["squad_request_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_fill_requests_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "squad_fill_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_request_events: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          post_id: string
          request_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          post_id: string
          request_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          post_id?: string
          request_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_request_events_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "squad_fill_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "squad_fill_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          body: string
          created_at: string
          id: string
          priority: string
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          priority?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          priority?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          captain_id: string
          created_at: string
          id: string
          logo_url: string | null
          name: string
          sport_id: string | null
        }
        Insert: {
          captain_id: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          sport_id?: string | null
        }
        Update: {
          captain_id?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          sport_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_fixtures: {
        Row: {
          created_at: string
          id: string
          position: number
          round: number
          scheduled_at: string | null
          score_a: number | null
          score_b: number | null
          status: string
          team_a_id: string | null
          team_b_id: string | null
          tournament_id: string
          updated_at: string
          winner_team_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          position: number
          round: number
          scheduled_at?: string | null
          score_a?: number | null
          score_b?: number | null
          status?: string
          team_a_id?: string | null
          team_b_id?: string | null
          tournament_id: string
          updated_at?: string
          winner_team_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          round?: number
          scheduled_at?: string | null
          score_a?: number | null
          score_b?: number | null
          status?: string
          team_a_id?: string | null
          team_b_id?: string | null
          tournament_id?: string
          updated_at?: string
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_fixtures_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_fixtures_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_fixtures_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_fixtures_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_registrations: {
        Row: {
          created_at: string
          id: string
          status: string
          team_id: string | null
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          team_id?: string | null
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          team_id?: string | null
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_registrations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          end_date: string | null
          entry_fee: number
          format: string | null
          id: string
          is_featured: boolean
          max_teams: number | null
          name: string
          owner_id: string
          sport_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["tournament_status"]
          turf_id: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          entry_fee?: number
          format?: string | null
          id?: string
          is_featured?: boolean
          max_teams?: number | null
          name: string
          owner_id: string
          sport_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["tournament_status"]
          turf_id: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          entry_fee?: number
          format?: string | null
          id?: string
          is_featured?: boolean
          max_teams?: number | null
          name?: string
          owner_id?: string
          sport_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["tournament_status"]
          turf_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_turf_id_fkey"
            columns: ["turf_id"]
            isOneToOne: false
            referencedRelation: "turfs"
            referencedColumns: ["id"]
          },
        ]
      }
      turf_amenities: {
        Row: {
          amenity_id: string
          turf_id: string
        }
        Insert: {
          amenity_id: string
          turf_id: string
        }
        Update: {
          amenity_id?: string
          turf_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turf_amenities_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turf_amenities_turf_id_fkey"
            columns: ["turf_id"]
            isOneToOne: false
            referencedRelation: "turfs"
            referencedColumns: ["id"]
          },
        ]
      }
      turf_images: {
        Row: {
          created_at: string
          id: string
          position: number
          turf_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          turf_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          turf_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "turf_images_turf_id_fkey"
            columns: ["turf_id"]
            isOneToOne: false
            referencedRelation: "turfs"
            referencedColumns: ["id"]
          },
        ]
      }
      turf_sports: {
        Row: {
          sport_id: string
          turf_id: string
        }
        Insert: {
          sport_id: string
          turf_id: string
        }
        Update: {
          sport_id?: string
          turf_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turf_sports_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turf_sports_turf_id_fkey"
            columns: ["turf_id"]
            isOneToOne: false
            referencedRelation: "turfs"
            referencedColumns: ["id"]
          },
        ]
      }
      turfs: {
        Row: {
          address: string
          base_price: number
          cancellation_fee_pct: number
          cancellation_hours: number
          city: string
          country: string
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_featured: boolean
          lat: number | null
          lng: number | null
          name: string
          owner_id: string
          rating: number
          rejection_reason: string | null
          reschedule_hours: number
          reviewed_at: string | null
          reviewed_by: string | null
          rules: string | null
          slug: string
          state: string | null
          status: Database["public"]["Enums"]["turf_status"]
          total_reviews: number
          updated_at: string
          verification_checklist: Json
        }
        Insert: {
          address: string
          base_price?: number
          cancellation_fee_pct?: number
          cancellation_hours?: number
          city: string
          country?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          owner_id: string
          rating?: number
          rejection_reason?: string | null
          reschedule_hours?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          rules?: string | null
          slug: string
          state?: string | null
          status?: Database["public"]["Enums"]["turf_status"]
          total_reviews?: number
          updated_at?: string
          verification_checklist?: Json
        }
        Update: {
          address?: string
          base_price?: number
          cancellation_fee_pct?: number
          cancellation_hours?: number
          city?: string
          country?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          owner_id?: string
          rating?: number
          rejection_reason?: string | null
          reschedule_hours?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          rules?: string | null
          slug?: string
          state?: string | null
          status?: Database["public"]["Enums"]["turf_status"]
          total_reviews?: number
          updated_at?: string
          verification_checklist?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_in_booking: {
        Args: { _booking_id: string }
        Returns: {
          add_ons_amount: number
          cancellation_reason: string | null
          cancelled_at: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          currency: string
          end_at: string
          id: string
          is_offline: boolean
          lock_expires_at: string | null
          notes: string | null
          offline_customer_name: string | null
          offline_customer_phone: string | null
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pitch_type_id: string | null
          rescheduled_from_id: string | null
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          subtotal_amount: number
          total_amount: number
          turf_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_booking_payment: {
        Args: { _booking_id: string; _method: string }
        Returns: {
          add_ons_amount: number
          cancellation_reason: string | null
          cancelled_at: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          currency: string
          end_at: string
          id: string
          is_offline: boolean
          lock_expires_at: string | null
          notes: string | null
          offline_customer_name: string | null
          offline_customer_phone: string | null
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pitch_type_id: string | null
          rescheduled_from_id: string | null
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          subtotal_amount: number
          total_amount: number
          turf_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_booked_slots: {
        Args: { _day: string; _turf_id: string }
        Returns: {
          end_at: string
          pitch_type_id: string
          start_at: string
          status: string
        }[]
      }
      get_open_squad_posts: {
        Args: never
        Returns: {
          approval_mode: string
          booking_id: string
          created_at: string
          emergency_expires_at: string
          end_at: string
          fill_type: string
          host_id: string
          host_name: string
          id: string
          join_fee: number
          notes: string
          skill_level: string
          sport_id: string
          sport_name: string
          spots_filled: number
          spots_needed: number
          start_at: string
          status: string
          turf_city: string
          turf_cover_image_url: string
          turf_id: string
          turf_name: string
          turf_slug: string
        }[]
      }
      get_squad_post: {
        Args: { _id: string }
        Returns: {
          approval_mode: string
          booking_id: string
          created_at: string
          emergency_expires_at: string
          end_at: string
          fill_type: string
          host_id: string
          host_name: string
          id: string
          join_fee: number
          notes: string
          skill_level: string
          sport_id: string
          sport_name: string
          spots_filled: number
          spots_needed: number
          start_at: string
          status: string
          turf_address: string
          turf_city: string
          turf_cover_image_url: string
          turf_id: string
          turf_name: string
          turf_slug: string
        }[]
      }
      get_tournament_capacity: {
        Args: { _tournament_id: string }
        Returns: {
          approved_count: number
          is_full: boolean
          max_teams: number
        }[]
      }
      mark_booking_completed: {
        Args: { _booking_id: string }
        Returns: {
          add_ons_amount: number
          cancellation_reason: string | null
          cancelled_at: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          currency: string
          end_at: string
          id: string
          is_offline: boolean
          lock_expires_at: string | null
          notes: string | null
          offline_customer_name: string | null
          offline_customer_phone: string | null
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pitch_type_id: string | null
          rescheduled_from_id: string | null
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          subtotal_amount: number
          total_amount: number
          turf_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      squad_post_expire_due: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "player" | "owner" | "admin"
      approval_mode: "host_approval" | "instant_join"
      booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "refunded"
      match_status: "scheduled" | "live" | "completed" | "cancelled"
      notification_type:
        | "booking"
        | "squad_fill"
        | "tournament"
        | "system"
        | "review"
      payment_provider: "manual" | "stripe" | "razorpay" | "paypal"
      payment_status: "unpaid" | "pending" | "paid" | "refunded" | "failed"
      skill_level: "beginner" | "intermediate" | "advanced" | "pro" | "any"
      squad_fill_type: "pre_match" | "emergency"
      squad_post_status: "open" | "full" | "closed" | "expired"
      squad_request_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "joined"
      ticket_status: "open" | "in_progress" | "resolved" | "closed"
      tournament_status:
        | "draft"
        | "open"
        | "closed"
        | "live"
        | "completed"
        | "cancelled"
      turf_status: "pending" | "approved" | "suspended" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["player", "owner", "admin"],
      approval_mode: ["host_approval", "instant_join"],
      booking_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "refunded",
      ],
      match_status: ["scheduled", "live", "completed", "cancelled"],
      notification_type: [
        "booking",
        "squad_fill",
        "tournament",
        "system",
        "review",
      ],
      payment_provider: ["manual", "stripe", "razorpay", "paypal"],
      payment_status: ["unpaid", "pending", "paid", "refunded", "failed"],
      skill_level: ["beginner", "intermediate", "advanced", "pro", "any"],
      squad_fill_type: ["pre_match", "emergency"],
      squad_post_status: ["open", "full", "closed", "expired"],
      squad_request_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "joined",
      ],
      ticket_status: ["open", "in_progress", "resolved", "closed"],
      tournament_status: [
        "draft",
        "open",
        "closed",
        "live",
        "completed",
        "cancelled",
      ],
      turf_status: ["pending", "approved", "suspended", "rejected"],
    },
  },
} as const
