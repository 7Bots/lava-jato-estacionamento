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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      carwash_services: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          owner_id: string
          price_cents: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          owner_id: string
          price_cents?: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          price_cents?: number
          sort_order?: number
        }
        Relationships: []
      }
      carwash_ticket_services: {
        Row: {
          created_at: string
          id: string
          name_snapshot: string
          owner_id: string
          price_cents_snapshot: number
          service_id: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_snapshot: string
          owner_id: string
          price_cents_snapshot: number
          service_id?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name_snapshot?: string
          owner_id?: string
          price_cents_snapshot?: number
          service_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carwash_ticket_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "carwash_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carwash_ticket_services_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "carwash_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      carwash_tickets: {
        Row: {
          arrived_at: string
          completed_at: string | null
          created_at: string
          customer_id: string | null
          id: string
          manual_discount_cents: number
          notes: string | null
          owner_id: string
          payment_method: string | null
          plate: string
          stage: string
          started_at: string | null
          subtotal_cents: number
          total_cents: number
          vehicle_id: string | null
          vehicle_type: string
        }
        Insert: {
          arrived_at?: string
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          manual_discount_cents?: number
          notes?: string | null
          owner_id: string
          payment_method?: string | null
          plate: string
          stage?: string
          started_at?: string | null
          subtotal_cents?: number
          total_cents?: number
          vehicle_id?: string | null
          vehicle_type?: string
        }
        Update: {
          arrived_at?: string
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          manual_discount_cents?: number
          notes?: string | null
          owner_id?: string
          payment_method?: string | null
          plate?: string
          stage?: string
          started_at?: string | null
          subtotal_cents?: number
          total_cents?: number
          vehicle_id?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "carwash_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carwash_tickets_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          auto_created: boolean
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
        }
        Insert: {
          auto_created?: boolean
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
        }
        Update: {
          auto_created?: boolean
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount_cents: number
          category: string | null
          created_at: string
          date: string
          description: string
          id: string
          module: string
          owner_id: string
        }
        Insert: {
          amount_cents: number
          category?: string | null
          created_at?: string
          date: string
          description: string
          id?: string
          module?: string
          owner_id: string
        }
        Update: {
          amount_cents?: number
          category?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          module?: string
          owner_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          block_minutes: number
          business_doc: string | null
          business_name: string | null
          business_phone: string | null
          created_at: string
          daily_car_cents: number
          daily_moto_cents: number
          grace_minutes: number
          id: string
          owner_id: string
          price_car_cents: number
          price_moto_cents: number
        }
        Insert: {
          block_minutes?: number
          business_doc?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string
          daily_car_cents?: number
          daily_moto_cents?: number
          grace_minutes?: number
          id?: string
          owner_id: string
          price_car_cents?: number
          price_moto_cents?: number
        }
        Update: {
          block_minutes?: number
          business_doc?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string
          daily_car_cents?: number
          daily_moto_cents?: number
          grace_minutes?: number
          id?: string
          owner_id?: string
          price_car_cents?: number
          price_moto_cents?: number
        }
        Relationships: []
      }
      spots: {
        Row: {
          active: boolean
          created_at: string
          id: string
          label: string
          owner_id: string
          type: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          label: string
          owner_id: string
          type: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string
          owner_id?: string
          type?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          block_minutes: number
          checkin_at: string
          checkout_at: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string | null
          daily_cents: number
          force_daily: boolean
          grace_minutes: number
          id: string
          manual_discount_cents: number
          owner_id: string
          payment_method: string | null
          plate: string
          price_block_cents: number
          spot_id: string | null
          status: string
          total_cents: number | null
          vehicle_id: string | null
          vehicle_type: string
        }
        Insert: {
          block_minutes: number
          checkin_at?: string
          checkout_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string | null
          daily_cents: number
          force_daily?: boolean
          grace_minutes: number
          id?: string
          manual_discount_cents?: number
          owner_id: string
          payment_method?: string | null
          plate: string
          price_block_cents: number
          spot_id?: string | null
          status?: string
          total_cents?: number | null
          vehicle_id?: string | null
          vehicle_type: string
        }
        Update: {
          block_minutes?: number
          checkin_at?: string
          checkout_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string | null
          daily_cents?: number
          force_daily?: boolean
          grace_minutes?: number
          id?: string
          manual_discount_cents?: number
          owner_id?: string
          payment_method?: string | null
          plate?: string
          price_block_cents?: number
          spot_id?: string | null
          status?: string
          total_cents?: number | null
          vehicle_id?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string | null
          color: string | null
          created_at: string
          customer_id: string | null
          id: string
          model: string | null
          owner_id: string
          plate: string
          type: string
        }
        Insert: {
          brand?: string | null
          color?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          model?: string | null
          owner_id: string
          plate: string
          type: string
        }
        Update: {
          brand?: string | null
          color?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          model?: string | null
          owner_id?: string
          plate?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
