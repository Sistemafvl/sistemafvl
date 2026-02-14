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
      driver_rides: {
        Row: {
          completed_at: string
          driver_id: string
          id: string
          login: string | null
          notes: string | null
          password: string | null
          queue_entry_id: string | null
          route: string | null
          sequence_number: number | null
          unit_id: string
        }
        Insert: {
          completed_at?: string
          driver_id: string
          id?: string
          login?: string | null
          notes?: string | null
          password?: string | null
          queue_entry_id?: string | null
          route?: string | null
          sequence_number?: number | null
          unit_id: string
        }
        Update: {
          completed_at?: string
          driver_id?: string
          id?: string
          login?: string | null
          notes?: string | null
          password?: string | null
          queue_entry_id?: string | null
          route?: string | null
          sequence_number?: number | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
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
        ]
      }
      drivers: {
        Row: {
          active: boolean
          address: string | null
          avatar_url: string | null
          bio: string | null
          car_color: string | null
          car_model: string
          car_plate: string
          cep: string | null
          city: string | null
          cpf: string
          created_at: string
          email: string | null
          id: string
          name: string
          neighborhood: string | null
          password: string
          state: string | null
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          car_color?: string | null
          car_model: string
          car_plate: string
          cep?: string | null
          city?: string | null
          cpf: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          neighborhood?: string | null
          password: string
          state?: string | null
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          car_color?: string | null
          car_model?: string
          car_plate?: string
          cep?: string | null
          city?: string | null
          cpf?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          neighborhood?: string | null
          password?: string
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
            foreignKeyName: "queue_entries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          active: boolean
          created_at: string
          domain_id: string
          id: string
          name: string
          password: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          domain_id: string
          id?: string
          name: string
          password: string
        }
        Update: {
          active?: boolean
          created_at?: string
          domain_id?: string
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
