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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cycle_records: {
        Row: {
          abertura_galpao: string | null
          created_at: string
          hora_inicio_descarregamento: string | null
          hora_termino_descarregamento: string | null
          id: string
          qtd_pacotes: number | null
          record_date: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          abertura_galpao?: string | null
          created_at?: string
          hora_inicio_descarregamento?: string | null
          hora_termino_descarregamento?: string | null
          id?: string
          qtd_pacotes?: number | null
          record_date?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          abertura_galpao?: string | null
          created_at?: string
          hora_inicio_descarregamento?: string | null
          hora_termino_descarregamento?: string | null
          id?: string
          qtd_pacotes?: number | null
          record_date?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      dnr_entries: {
        Row: {
          approved_at: string | null
          car_color: string | null
          car_model: string | null
          car_plate: string | null
          closed_at: string | null
          conferente_name: string | null
          created_at: string
          created_by_name: string | null
          discounted: boolean
          dnr_value: number
          driver_id: string | null
          driver_name: string | null
          id: string
          loaded_at: string | null
          login: string | null
          observations: string | null
          reported_in_payroll_id: string | null
          ride_id: string | null
          route: string | null
          status: string
          tbr_code: string
          unit_id: string
        }
        Insert: {
          approved_at?: string | null
          car_color?: string | null
          car_model?: string | null
          car_plate?: string | null
          closed_at?: string | null
          conferente_name?: string | null
          created_at?: string
          created_by_name?: string | null
          discounted?: boolean
          dnr_value?: number
          driver_id?: string | null
          driver_name?: string | null
          id?: string
          loaded_at?: string | null
          login?: string | null
          observations?: string | null
          reported_in_payroll_id?: string | null
          ride_id?: string | null
          route?: string | null
          status?: string
          tbr_code: string
          unit_id: string
        }
        Update: {
          approved_at?: string | null
          car_color?: string | null
          car_model?: string | null
          car_plate?: string | null
          closed_at?: string | null
          conferente_name?: string | null
          created_at?: string
          created_by_name?: string | null
          discounted?: boolean
          dnr_value?: number
          driver_id?: string | null
          driver_name?: string | null
          id?: string
          loaded_at?: string | null
          login?: string | null
          observations?: string | null
          reported_in_payroll_id?: string | null
          ride_id?: string | null
          route?: string | null
          status?: string
          tbr_code?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dnr_entries_reported_in_payroll_id_fkey"
            columns: ["reported_in_payroll_id"]
            isOneToOne: false
            referencedRelation: "payroll_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      driver_bonus: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          driver_id: string
          driver_name: string | null
          id: string
          period_end: string
          period_start: string
          unit_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          driver_id: string
          driver_name?: string | null
          id?: string
          period_end: string
          period_start: string
          unit_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          driver_id?: string
          driver_name?: string | null
          id?: string
          period_end?: string
          period_start?: string
          unit_id?: string
        }
        Relationships: []
      }
      driver_custom_values: {
        Row: {
          created_at: string
          custom_tbr_value: number
          driver_id: string
          id: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          custom_tbr_value?: number
          driver_id: string
          id?: string
          unit_id: string
        }
        Update: {
          created_at?: string
          custom_tbr_value?: number
          driver_id?: string
          id?: string
          unit_id?: string
        }
        Relationships: []
      }
      driver_documents: {
        Row: {
          created_at: string
          doc_type: string
          driver_id: string
          file_name: string
          file_url: string
          id: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          driver_id: string
          file_name: string
          file_url: string
          id?: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          driver_id?: string
          file_name?: string
          file_url?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_invoices: {
        Row: {
          created_at: string
          driver_id: string
          file_name: string | null
          file_url: string | null
          id: string
          payroll_report_id: string
          unit_id: string
          uploaded_at: string | null
        }
        Insert: {
          created_at?: string
          driver_id: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          payroll_report_id: string
          unit_id: string
          uploaded_at?: string | null
        }
        Update: {
          created_at?: string
          driver_id?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          payroll_report_id?: string
          unit_id?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_invoices_payroll_report_id_fkey"
            columns: ["payroll_report_id"]
            isOneToOne: false
            referencedRelation: "payroll_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_rides: {
        Row: {
          completed_at: string
          conferente_id: string | null
          driver_id: string
          finished_at: string | null
          id: string
          loading_status: string | null
          login: string | null
          notes: string | null
          password: string | null
          queue_entry_id: string | null
          route: string | null
          sequence_number: number | null
          started_at: string | null
          unit_id: string
        }
        Insert: {
          completed_at?: string
          conferente_id?: string | null
          driver_id: string
          finished_at?: string | null
          id?: string
          loading_status?: string | null
          login?: string | null
          notes?: string | null
          password?: string | null
          queue_entry_id?: string | null
          route?: string | null
          sequence_number?: number | null
          started_at?: string | null
          unit_id: string
        }
        Update: {
          completed_at?: string
          conferente_id?: string | null
          driver_id?: string
          finished_at?: string | null
          id?: string
          loading_status?: string | null
          login?: string | null
          notes?: string | null
          password?: string | null
          queue_entry_id?: string | null
          route?: string | null
          sequence_number?: number | null
          started_at?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_rides_conferente_id_fkey"
            columns: ["conferente_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_rides_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "queue_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_rides_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_rides_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_public"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          active: boolean
          address: string | null
          avatar_url: string | null
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          bio: string | null
          car_color: string | null
          car_model: string
          car_plate: string
          cep: string | null
          city: string | null
          cpf: string
          created_at: string
          email: string | null
          house_number: string | null
          id: string
          name: string
          neighborhood: string | null
          password: string
          pix_key: string | null
          pix_key_name: string | null
          pix_key_type: string | null
          state: string | null
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          bio?: string | null
          car_color?: string | null
          car_model: string
          car_plate: string
          cep?: string | null
          city?: string | null
          cpf: string
          created_at?: string
          email?: string | null
          house_number?: string | null
          id?: string
          name: string
          neighborhood?: string | null
          password: string
          pix_key?: string | null
          pix_key_name?: string | null
          pix_key_type?: string | null
          state?: string | null
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          bio?: string | null
          car_color?: string | null
          car_model?: string
          car_plate?: string
          cep?: string | null
          city?: string | null
          cpf?: string
          created_at?: string
          email?: string | null
          house_number?: string | null
          id?: string
          name?: string
          neighborhood?: string | null
          password?: string
          pix_key?: string | null
          pix_key_name?: string | null
          pix_key_type?: string | null
          state?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      managers: {
        Row: {
          active: boolean
          cnpj: string
          created_at: string
          id: string
          manager_password: string | null
          name: string
          password: string
          unit_id: string
        }
        Insert: {
          active?: boolean
          cnpj: string
          created_at?: string
          id?: string
          manager_password?: string | null
          name: string
          password: string
          unit_id: string
        }
        Update: {
          active?: boolean
          cnpj?: string
          created_at?: string
          id?: string
          manager_password?: string | null
          name?: string
          password?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "managers_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "managers_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_reports: {
        Row: {
          created_at: string
          generated_by: string
          id: string
          period_end: string
          period_start: string
          report_data: Json
          unit_id: string
        }
        Insert: {
          created_at?: string
          generated_by: string
          id?: string
          period_end: string
          period_start: string
          report_data: Json
          unit_id: string
        }
        Update: {
          created_at?: string
          generated_by?: string
          id?: string
          period_end?: string
          period_start?: string
          report_data?: Json
          unit_id?: string
        }
        Relationships: []
      }
      piso_entries: {
        Row: {
          closed_at: string | null
          conferente_id: string | null
          created_at: string
          driver_name: string | null
          id: string
          reason: string
          ride_id: string | null
          route: string | null
          status: string
          tbr_code: string
          unit_id: string
        }
        Insert: {
          closed_at?: string | null
          conferente_id?: string | null
          created_at?: string
          driver_name?: string | null
          id?: string
          reason: string
          ride_id?: string | null
          route?: string | null
          status?: string
          tbr_code: string
          unit_id: string
        }
        Update: {
          closed_at?: string | null
          conferente_id?: string | null
          created_at?: string
          driver_name?: string | null
          id?: string
          reason?: string
          ride_id?: string | null
          route?: string | null
          status?: string
          tbr_code?: string
          unit_id?: string
        }
        Relationships: []
      }
      piso_reasons: {
        Row: {
          created_at: string
          id: string
          label: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          unit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          unit_id?: string
        }
        Relationships: []
      }
      ps_entries: {
        Row: {
          closed_at: string | null
          conferente_id: string | null
          created_at: string
          description: string
          driver_name: string | null
          id: string
          is_seller: boolean
          observations: string | null
          photo_url: string | null
          reason: string | null
          ride_id: string | null
          route: string | null
          status: string
          tbr_code: string
          unit_id: string
        }
        Insert: {
          closed_at?: string | null
          conferente_id?: string | null
          created_at?: string
          description: string
          driver_name?: string | null
          id?: string
          is_seller?: boolean
          observations?: string | null
          photo_url?: string | null
          reason?: string | null
          ride_id?: string | null
          route?: string | null
          status?: string
          tbr_code: string
          unit_id: string
        }
        Update: {
          closed_at?: string | null
          conferente_id?: string | null
          created_at?: string
          description?: string
          driver_name?: string | null
          id?: string
          is_seller?: boolean
          observations?: string | null
          photo_url?: string | null
          reason?: string | null
          ride_id?: string | null
          route?: string | null
          status?: string
          tbr_code?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ps_entries_conferente_id_fkey"
            columns: ["conferente_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ps_entries_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "driver_rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ps_entries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ps_entries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ps_reasons: {
        Row: {
          created_at: string
          id: string
          label: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          unit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ps_reasons_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ps_reasons_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_public"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_entries: {
        Row: {
          called_at: string | null
          completed_at: string | null
          driver_id: string
          id: string
          joined_at: string
          status: string
          unit_id: string
        }
        Insert: {
          called_at?: string | null
          completed_at?: string | null
          driver_id: string
          id?: string
          joined_at?: string
          status?: string
          unit_id: string
        }
        Update: {
          called_at?: string | null
          completed_at?: string | null
          driver_id?: string
          id?: string
          joined_at?: string
          status?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_entries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_tbrs: {
        Row: {
          code: string
          highlight: string | null
          id: string
          ride_id: string
          scanned_at: string | null
          trip_number: number
        }
        Insert: {
          code: string
          highlight?: string | null
          id?: string
          ride_id: string
          scanned_at?: string | null
          trip_number?: number
        }
        Update: {
          code?: string
          highlight?: string | null
          id?: string
          ride_id?: string
          scanned_at?: string | null
          trip_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "ride_tbrs_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "driver_rides"
            referencedColumns: ["id"]
          },
        ]
      }
      rto_entries: {
        Row: {
          cep: string | null
          closed_at: string | null
          conferente_id: string | null
          created_at: string
          description: string
          driver_name: string | null
          id: string
          ride_id: string | null
          route: string | null
          status: string
          tbr_code: string
          unit_id: string
        }
        Insert: {
          cep?: string | null
          closed_at?: string | null
          conferente_id?: string | null
          created_at?: string
          description: string
          driver_name?: string | null
          id?: string
          ride_id?: string | null
          route?: string | null
          status?: string
          tbr_code: string
          unit_id: string
        }
        Update: {
          cep?: string | null
          closed_at?: string | null
          conferente_id?: string | null
          created_at?: string
          description?: string
          driver_name?: string | null
          id?: string
          ride_id?: string | null
          route?: string | null
          status?: string
          tbr_code?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rto_entries_conferente_id_fkey"
            columns: ["conferente_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rto_entries_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "driver_rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rto_entries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rto_entries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_public"
            referencedColumns: ["id"]
          },
        ]
      }
      system_updates: {
        Row: {
          created_at: string
          description: string
          id: string
          module: string
          published_at: string
          type: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          module: string
          published_at?: string
          type?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          module?: string
          published_at?: string
          type?: string
        }
        Relationships: []
      }
      unit_logins: {
        Row: {
          active: boolean
          created_at: string
          id: string
          login: string
          password: string
          unit_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          login: string
          password: string
          unit_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          login?: string
          password?: string
          unit_id?: string
        }
        Relationships: []
      }
      unit_reviews: {
        Row: {
          comment: string | null
          created_at: string
          driver_id: string
          id: string
          rating: number
          unit_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          driver_id: string
          id?: string
          rating: number
          unit_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          driver_id?: string
          id?: string
          rating?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_reviews_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_reviews_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_reviews_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_reviews_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_public"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_settings: {
        Row: {
          created_at: string
          id: string
          tbr_value: number
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          tbr_value?: number
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          tbr_value?: number
          unit_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          active: boolean
          created_at: string
          domain_id: string
          geofence_address: string | null
          geofence_lat: number | null
          geofence_lng: number | null
          geofence_radius_meters: number | null
          id: string
          name: string
          password: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          domain_id: string
          geofence_address?: string | null
          geofence_lat?: number | null
          geofence_lng?: number | null
          geofence_radius_meters?: number | null
          id?: string
          name: string
          password: string
        }
        Update: {
          active?: boolean
          created_at?: string
          domain_id?: string
          geofence_address?: string | null
          geofence_lat?: number | null
          geofence_lng?: number | null
          geofence_radius_meters?: number | null
          id?: string
          name?: string
          password?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          active: boolean
          cpf: string
          created_at: string
          id: string
          name: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cpf: string
          created_at?: string
          id?: string
          name: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cpf?: string
          created_at?: string
          id?: string
          name?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      drivers_public: {
        Row: {
          active: boolean | null
          address: string | null
          avatar_url: string | null
          bio: string | null
          car_color: string | null
          car_model: string | null
          car_plate: string | null
          cep: string | null
          city: string | null
          cpf: string | null
          created_at: string | null
          email: string | null
          id: string | null
          name: string | null
          neighborhood: string | null
          state: string | null
          whatsapp: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          car_color?: string | null
          car_model?: string | null
          car_plate?: string | null
          cep?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          name?: string | null
          neighborhood?: string | null
          state?: string | null
          whatsapp?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          car_color?: string | null
          car_model?: string | null
          car_plate?: string | null
          cep?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          name?: string | null
          neighborhood?: string | null
          state?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      managers_public: {
        Row: {
          active: boolean | null
          cnpj: string | null
          created_at: string | null
          id: string | null
          name: string | null
          unit_id: string | null
        }
        Insert: {
          active?: boolean | null
          cnpj?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          unit_id?: string | null
        }
        Update: {
          active?: boolean | null
          cnpj?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "managers_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "managers_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_public"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_logins_public: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string | null
          login: string | null
          unit_id: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string | null
          login?: string | null
          unit_id?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string | null
          login?: string | null
          unit_id?: string | null
        }
        Relationships: []
      }
      units_public: {
        Row: {
          active: boolean | null
          created_at: string | null
          domain_id: string | null
          geofence_address: string | null
          geofence_lat: number | null
          geofence_lng: number | null
          geofence_radius_meters: number | null
          id: string | null
          name: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          domain_id?: string | null
          geofence_address?: string | null
          geofence_lat?: number | null
          geofence_lng?: number | null
          geofence_radius_meters?: number | null
          id?: string | null
          name?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          domain_id?: string | null
          geofence_address?: string | null
          geofence_lat?: number | null
          geofence_lng?: number | null
          geofence_radius_meters?: number | null
          id?: string | null
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
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
      app_role: ["admin"],
    },
  },
} as const
