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
      active_projects: {
        Row: {
          client_id: string | null
          client_name: string
          created_at: string
          created_by: string | null
          credentials_sent: boolean | null
          deadline: string | null
          domain_purchased: boolean | null
          id: string
          lead_id: string | null
          paid_amount: number
          project_name: string
          project_type: string
          retainer_paid: boolean | null
          ssl_active: boolean | null
          stage: Database["public"]["Enums"]["project_stage"]
          start_date: string
          status: Database["public"]["Enums"]["project_status"]
          total_budget: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_name: string
          created_at?: string
          created_by?: string | null
          credentials_sent?: boolean | null
          deadline?: string | null
          domain_purchased?: boolean | null
          id?: string
          lead_id?: string | null
          paid_amount?: number
          project_name: string
          project_type: string
          retainer_paid?: boolean | null
          ssl_active?: boolean | null
          stage?: Database["public"]["Enums"]["project_stage"]
          start_date?: string
          status?: Database["public"]["Enums"]["project_status"]
          total_budget?: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          credentials_sent?: boolean | null
          deadline?: string | null
          domain_purchased?: boolean | null
          id?: string
          lead_id?: string | null
          paid_amount?: number
          project_name?: string
          project_type?: string
          retainer_paid?: boolean | null
          ssl_active?: boolean | null
          stage?: Database["public"]["Enums"]["project_stage"]
          start_date?: string
          status?: Database["public"]["Enums"]["project_status"]
          total_budget?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      client_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          project_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          project_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          project_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          base_salary: number
          created_at: string
          department: string | null
          designation: string
          id: string
          joining_date: string
          phone: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_salary?: number
          created_at?: string
          department?: string | null
          designation: string
          id?: string
          joining_date?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_salary?: number
          created_at?: string
          department?: string | null
          designation?: string
          id?: string
          joining_date?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          id: string
          title: string
        }
        Insert: {
          amount: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          title: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      interactions: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          id: string
          lead_id: string
          notes: string | null
          type: Database["public"]["Enums"]["interaction_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          lead_id: string
          notes?: string | null
          type: Database["public"]["Enums"]["interaction_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          lead_id?: string
          notes?: string | null
          type?: Database["public"]["Enums"]["interaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          invoice_number: string
          notes: string | null
          project_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          business_name: string
          category: Database["public"]["Enums"]["lead_category"] | null
          city: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          facebook_page: string | null
          id: string
          next_follow_up: string | null
          notes: string | null
          phone: string | null
          sl_no: number | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_name: string
          category?: Database["public"]["Enums"]["lead_category"] | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          facebook_page?: string | null
          id?: string
          next_follow_up?: string | null
          notes?: string | null
          phone?: string | null
          sl_no?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_name?: string
          category?: Database["public"]["Enums"]["lead_category"] | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          facebook_page?: string | null
          id?: string
          next_follow_up?: string | null
          notes?: string | null
          phone?: string | null
          sl_no?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: []
      }
      payroll_log: {
        Row: {
          amount_paid: number
          bonus: number | null
          created_at: string
          created_by: string | null
          deduction: number | null
          employee_id: string
          id: string
          notes: string | null
          payment_date: string
        }
        Insert: {
          amount_paid: number
          bonus?: number | null
          created_at?: string
          created_by?: string | null
          deduction?: number | null
          employee_id: string
          id?: string
          notes?: string | null
          payment_date?: string
        }
        Update: {
          amount_paid?: number
          bonus?: number | null
          created_at?: string
          created_by?: string | null
          deduction?: number | null
          employee_id?: string
          id?: string
          notes?: string | null
          payment_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number | null
          featured: boolean | null
          id: string
          image_url: string | null
          project_url: string | null
          technologies: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          project_url?: string | null
          technologies?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          project_url?: string | null
          technologies?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      pricing_tiers: {
        Row: {
          billing_cycle: string | null
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number | null
          features: string[] | null
          id: string
          is_active: boolean | null
          is_popular: boolean | null
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          billing_cycle?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          features?: string[] | null
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          billing_cycle?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          features?: string[] | null
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_updates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          project_id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          project_id: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number | null
          features: string[] | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          features?: string[] | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          features?: string[] | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "employee" | "client"
      expense_category:
        | "rent"
        | "server"
        | "software"
        | "marketing"
        | "salary"
        | "utilities"
        | "office_supplies"
        | "travel"
        | "other"
      interaction_type: "call" | "meeting" | "email" | "note"
      lead_category:
        | "study_abroad"
        | "fashion"
        | "real_estate"
        | "healthcare"
        | "technology"
        | "education"
        | "retail"
        | "hospitality"
        | "other"
      lead_status:
        | "new"
        | "contacted"
        | "in_negotiation"
        | "deal_won"
        | "deal_lost"
      project_stage:
        | "discovery"
        | "requirement"
        | "strategy"
        | "design"
        | "development"
        | "qa"
        | "deployment"
        | "maintenance"
      project_status: "active" | "completed" | "on_hold" | "cancelled"
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
      app_role: ["admin", "employee", "client"],
      expense_category: [
        "rent",
        "server",
        "software",
        "marketing",
        "salary",
        "utilities",
        "office_supplies",
        "travel",
        "other",
      ],
      interaction_type: ["call", "meeting", "email", "note"],
      lead_category: [
        "study_abroad",
        "fashion",
        "real_estate",
        "healthcare",
        "technology",
        "education",
        "retail",
        "hospitality",
        "other",
      ],
      lead_status: [
        "new",
        "contacted",
        "in_negotiation",
        "deal_won",
        "deal_lost",
      ],
      project_stage: [
        "discovery",
        "requirement",
        "strategy",
        "design",
        "development",
        "qa",
        "deployment",
        "maintenance",
      ],
      project_status: ["active", "completed", "on_hold", "cancelled"],
    },
  },
} as const
