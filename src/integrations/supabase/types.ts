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
      app_notification_prefs: {
        Row: {
          created_at: string
          email_daily_digest: boolean
          id: string
          module_toggles: Json
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_daily_digest?: boolean
          id?: string
          module_toggles?: Json
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_daily_digest?: boolean
          id?: string
          module_toggles?: Json
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_notifications: {
        Row: {
          action_link: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          module: Database["public"]["Enums"]["notification_module"]
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          action_link?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          module?: Database["public"]["Enums"]["notification_module"]
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          action_link?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          module?: Database["public"]["Enums"]["notification_module"]
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      asset_history: {
        Row: {
          action: string
          asset_id: string
          created_at: string
          details: string | null
          id: string
          new_value: string | null
          old_value: string | null
          performed_by: string | null
        }
        Insert: {
          action: string
          asset_id: string
          created_at?: string
          details?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          performed_by?: string | null
        }
        Update: {
          action?: string
          asset_id?: string
          created_at?: string
          details?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_name: string
          asset_tag: string
          assigned_at: string | null
          assigned_to: string | null
          brand: string | null
          category: string
          condition: Database["public"]["Enums"]["asset_condition"]
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          model: string | null
          notes: string | null
          purchase_date: string | null
          purchase_price: number | null
          serial_number: string | null
          status: Database["public"]["Enums"]["asset_status"]
          updated_at: string
          warranty_expiry: string | null
        }
        Insert: {
          asset_name: string
          asset_tag: string
          assigned_at?: string | null
          assigned_to?: string | null
          brand?: string | null
          category?: string
          condition?: Database["public"]["Enums"]["asset_condition"]
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          model?: string | null
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
          warranty_expiry?: string | null
        }
        Update: {
          asset_name?: string
          asset_tag?: string
          assigned_at?: string | null
          assigned_to?: string | null
          brand?: string | null
          category?: string
          condition?: Database["public"]["Enums"]["asset_condition"]
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          model?: string | null
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
          warranty_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_applications: {
        Row: {
          candidate_id: string
          cover_letter: string | null
          created_at: string
          expected_salary: string | null
          id: string
          internal_notes: string | null
          job_id: string
          rating: number | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
        }
        Insert: {
          candidate_id: string
          cover_letter?: string | null
          created_at?: string
          expected_salary?: string | null
          id?: string
          internal_notes?: string | null
          job_id: string
          rating?: number | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          cover_letter?: string | null
          created_at?: string
          expected_salary?: string | null
          id?: string
          internal_notes?: string | null
          job_id?: string
          rating?: number | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ats_applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "cms_job_openings"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_candidates: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          linkedin_url: string | null
          phone: string | null
          portfolio_url: string | null
          resume_url: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          linkedin_url?: string | null
          phone?: string | null
          portfolio_url?: string | null
          resume_url?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          linkedin_url?: string | null
          phone?: string | null
          portfolio_url?: string | null
          resume_url?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ats_interviews: {
        Row: {
          application_id: string
          created_at: string
          duration_minutes: number
          feedback: string | null
          id: string
          interviewer_id: string | null
          meeting_link: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["interview_status"]
          title: string
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          duration_minutes?: number
          feedback?: string | null
          id?: string
          interviewer_id?: string | null
          meeting_link?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["interview_status"]
          title?: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          duration_minutes?: number
          feedback?: string | null
          id?: string
          interviewer_id?: string | null
          meeting_link?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["interview_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ats_interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "ats_applications"
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
      client_tickets: {
        Row: {
          client_id: string
          created_at: string
          description: string
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          project_id: string | null
          resolution_notes: string | null
          status: Database["public"]["Enums"]["client_ticket_status"]
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          project_id?: string | null
          resolution_notes?: string | null
          status?: Database["public"]["Enums"]["client_ticket_status"]
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          project_id?: string | null
          resolution_notes?: string | null
          status?: Database["public"]["Enums"]["client_ticket_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_blog_posts: {
        Row: {
          author: string | null
          category: string | null
          content: Json | null
          created_at: string
          excerpt: string | null
          id: string
          image: string | null
          is_published: boolean
          publish_date: string | null
          read_time: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          category?: string | null
          content?: Json | null
          created_at?: string
          excerpt?: string | null
          id?: string
          image?: string | null
          is_published?: boolean
          publish_date?: string | null
          read_time?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          category?: string | null
          content?: Json | null
          created_at?: string
          excerpt?: string | null
          id?: string
          image?: string | null
          is_published?: boolean
          publish_date?: string | null
          read_time?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_demo_projects: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          design_unique: string | null
          development_process: string | null
          display_order: number | null
          features: string[] | null
          full_description: string | null
          id: string
          image: string | null
          is_active: boolean
          live_link: string | null
          short_description: string | null
          tech_stack: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          design_unique?: string | null
          development_process?: string | null
          display_order?: number | null
          features?: string[] | null
          full_description?: string | null
          id?: string
          image?: string | null
          is_active?: boolean
          live_link?: string | null
          short_description?: string | null
          tech_stack?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          design_unique?: string | null
          development_process?: string | null
          display_order?: number | null
          features?: string[] | null
          full_description?: string | null
          id?: string
          image?: string | null
          is_active?: boolean
          live_link?: string | null
          short_description?: string | null
          tech_stack?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_gallery: {
        Row: {
          alt: string | null
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean
          src: string
          title: string | null
        }
        Insert: {
          alt?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          src: string
          title?: string | null
        }
        Update: {
          alt?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          src?: string
          title?: string | null
        }
        Relationships: []
      }
      cms_job_openings: {
        Row: {
          about_role: string | null
          created_at: string
          created_by: string | null
          department: string
          display_order: number | null
          id: string
          is_active: boolean
          location: string
          requirements: string[] | null
          responsibilities: string[] | null
          salary: string | null
          short_description: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          about_role?: string | null
          created_at?: string
          created_by?: string | null
          department: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          location?: string
          requirements?: string[] | null
          responsibilities?: string[] | null
          salary?: string | null
          short_description?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          about_role?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          location?: string
          requirements?: string[] | null
          responsibilities?: string[] | null
          salary?: string | null
          short_description?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_partners: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean
          logo: string
          name: string
          website: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          logo: string
          name: string
          website?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          logo?: string
          name?: string
          website?: string | null
        }
        Relationships: []
      }
      cms_portfolio: {
        Row: {
          category: string | null
          challenge: string | null
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean
          project_id: string
          results: Json | null
          solution: string | null
          tech_stack: string[] | null
          thumbnail: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          challenge?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          project_id: string
          results?: Json | null
          solution?: string | null
          tech_stack?: string[] | null
          thumbnail?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          challenge?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          project_id?: string
          results?: Json | null
          solution?: string | null
          tech_stack?: string[] | null
          thumbnail?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_pricing_tiers: {
        Row: {
          badge: string | null
          category: string
          created_at: string
          cta: string | null
          description: string | null
          display_order: number | null
          features: string[] | null
          highlighted: boolean | null
          id: string
          is_active: boolean
          monthly_price: number | null
          name: string
          price: number | null
          tier_id: string
          updated_at: string
          yearly_price: number | null
        }
        Insert: {
          badge?: string | null
          category: string
          created_at?: string
          cta?: string | null
          description?: string | null
          display_order?: number | null
          features?: string[] | null
          highlighted?: boolean | null
          id?: string
          is_active?: boolean
          monthly_price?: number | null
          name: string
          price?: number | null
          tier_id: string
          updated_at?: string
          yearly_price?: number | null
        }
        Update: {
          badge?: string | null
          category?: string
          created_at?: string
          cta?: string | null
          description?: string | null
          display_order?: number | null
          features?: string[] | null
          highlighted?: boolean | null
          id?: string
          is_active?: boolean
          monthly_price?: number | null
          name?: string
          price?: number | null
          tier_id?: string
          updated_at?: string
          yearly_price?: number | null
        }
        Relationships: []
      }
      cms_products: {
        Row: {
          built_for: string | null
          capabilities: string[] | null
          created_at: string
          created_by: string | null
          developer: string | null
          display_order: number | null
          gallery: string[] | null
          hero_image: string | null
          highlights: string[] | null
          id: string
          is_active: boolean
          overview: string | null
          status: string | null
          summary: string | null
          tagline: string | null
          title: string
          updated_at: string
        }
        Insert: {
          built_for?: string | null
          capabilities?: string[] | null
          created_at?: string
          created_by?: string | null
          developer?: string | null
          display_order?: number | null
          gallery?: string[] | null
          hero_image?: string | null
          highlights?: string[] | null
          id?: string
          is_active?: boolean
          overview?: string | null
          status?: string | null
          summary?: string | null
          tagline?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          built_for?: string | null
          capabilities?: string[] | null
          created_at?: string
          created_by?: string | null
          developer?: string | null
          display_order?: number | null
          gallery?: string[] | null
          hero_image?: string | null
          highlights?: string[] | null
          id?: string
          is_active?: boolean
          overview?: string | null
          status?: string | null
          summary?: string | null
          tagline?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_service_details: {
        Row: {
          benefits: string[] | null
          created_at: string
          deliverables: string[] | null
          faqs: Json | null
          hero_image: string | null
          id: string
          overview: string | null
          process: Json | null
          service_id: string
          tagline: string | null
          tech_stack: string[] | null
          updated_at: string
        }
        Insert: {
          benefits?: string[] | null
          created_at?: string
          deliverables?: string[] | null
          faqs?: Json | null
          hero_image?: string | null
          id?: string
          overview?: string | null
          process?: Json | null
          service_id: string
          tagline?: string | null
          tech_stack?: string[] | null
          updated_at?: string
        }
        Update: {
          benefits?: string[] | null
          created_at?: string
          deliverables?: string[] | null
          faqs?: Json | null
          hero_image?: string | null
          id?: string
          overview?: string | null
          process?: Json | null
          service_id?: string
          tagline?: string | null
          tech_stack?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cms_service_details_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "cms_services"
            referencedColumns: ["service_id"]
          },
        ]
      }
      cms_services: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          features: string[] | null
          icon: string | null
          id: string
          is_active: boolean
          service_id: string
          short_description: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          features?: string[] | null
          icon?: string | null
          id?: string
          is_active?: boolean
          service_id: string
          short_description?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          features?: string[] | null
          icon?: string | null
          id?: string
          is_active?: boolean
          service_id?: string
          short_description?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_site_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      cms_team_members: {
        Row: {
          bio: string | null
          created_at: string
          display_order: number | null
          email: string | null
          id: string
          image: string | null
          is_active: boolean
          linkedin: string | null
          name: string
          portfolio: string | null
          role: string
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          display_order?: number | null
          email?: string | null
          id?: string
          image?: string | null
          is_active?: boolean
          linkedin?: string | null
          name: string
          portfolio?: string | null
          role: string
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          display_order?: number | null
          email?: string | null
          id?: string
          image?: string | null
          is_active?: boolean
          linkedin?: string | null
          name?: string
          portfolio?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_timeline: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          title: string
          year: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          title: string
          year: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          title?: string
          year?: string
        }
        Relationships: []
      }
      company_announcements: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          id: string
          is_published: boolean
          title: string
          type: Database["public"]["Enums"]["announcement_type"]
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_published?: boolean
          title: string
          type?: Database["public"]["Enums"]["announcement_type"]
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_published?: boolean
          title?: string
          type?: Database["public"]["Enums"]["announcement_type"]
          updated_at?: string
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          created_at: string
          document_url: string | null
          id: string
          title: string
          type: Database["public"]["Enums"]["document_type"]
          uploaded_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          document_url?: string | null
          id?: string
          title: string
          type?: Database["public"]["Enums"]["document_type"]
          uploaded_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          document_url?: string | null
          id?: string
          title?: string
          type?: Database["public"]["Enums"]["document_type"]
          uploaded_by?: string | null
          user_id?: string
        }
        Relationships: []
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
          base_salary: number
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
          status: string
          title: string
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          id?: string
          status?: string
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
          status?: string
          title?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          client_name: string
          contract_id: string | null
          created_at: string | null
          due_date: string | null
          id: string
          invoice_number: string | null
          issue_date: string | null
          items: Json | null
          notes: string | null
          paid_amount: number | null
          project_id: string | null
          status: string | null
          total_amount: number
        }
        Insert: {
          client_name: string
          contract_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          items?: Json | null
          notes?: string | null
          paid_amount?: number | null
          project_id?: string | null
          status?: string | null
          total_amount?: number
        }
        Update: {
          client_name?: string
          contract_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          items?: Json | null
          notes?: string | null
          paid_amount?: number | null
          project_id?: string | null
          status?: string | null
          total_amount?: number
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
      it_tickets: {
        Row: {
          category: Database["public"]["Enums"]["ticket_category"]
          created_at: string
          description: string
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution_notes: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          description: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolution_notes?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          description?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolution_notes?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          description: string | null
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
          website: string | null
        }
        Insert: {
          address?: string | null
          business_name: string
          category?: Database["public"]["Enums"]["lead_category"] | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
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
          website?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string
          category?: Database["public"]["Enums"]["lead_category"] | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
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
          website?: string | null
        }
        Relationships: []
      }
      leave_applications: {
        Row: {
          created_at: string
          employee_id: string
          end_date: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_date: string
          id?: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_applications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          lead_id: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_check_ins: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_result_id: string
          new_value: number
          notes: string | null
          previous_value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_result_id: string
          new_value: number
          notes?: string | null
          previous_value: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_result_id?: string
          new_value?: number
          notes?: string | null
          previous_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "okr_check_ins_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "okr_key_results"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_key_results: {
        Row: {
          created_at: string
          current_value: number
          id: string
          objective_id: string
          target_value: number
          title: string
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_value?: number
          id?: string
          objective_id: string
          target_value: number
          title: string
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_value?: number
          id?: string
          objective_id?: string
          target_value?: number
          title?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "okr_key_results_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "okr_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_objectives: {
        Row: {
          created_at: string
          cycle: string
          department: string | null
          description: string | null
          id: string
          level: Database["public"]["Enums"]["okr_level"]
          owner_id: string | null
          progress: number | null
          status: Database["public"]["Enums"]["okr_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle: string
          department?: string | null
          description?: string | null
          id?: string
          level?: Database["public"]["Enums"]["okr_level"]
          owner_id?: string | null
          progress?: number | null
          status?: Database["public"]["Enums"]["okr_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle?: string
          department?: string | null
          description?: string | null
          id?: string
          level?: Database["public"]["Enums"]["okr_level"]
          owner_id?: string | null
          progress?: number | null
          status?: Database["public"]["Enums"]["okr_status"]
          title?: string
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
          payment_date: string
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
          challenge: string | null
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number | null
          featured: boolean | null
          id: string
          image_url: string | null
          project_url: string | null
          results: Json | null
          solution: string | null
          tech_stack: string[] | null
          technologies: string[] | null
          thumbnail: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          challenge?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          project_url?: string | null
          results?: Json | null
          solution?: string | null
          tech_stack?: string[] | null
          technologies?: string[] | null
          thumbnail?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          challenge?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          project_url?: string | null
          results?: Json | null
          solution?: string | null
          tech_stack?: string[] | null
          technologies?: string[] | null
          thumbnail?: string | null
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
          cta: string | null
          description: string | null
          display_order: number | null
          features: string[] | null
          highlighted: boolean | null
          id: string
          is_active: boolean | null
          is_popular: boolean | null
          name: string
          price: number
          tier_id: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string | null
          created_at?: string
          created_by?: string | null
          cta?: string | null
          description?: string | null
          display_order?: number | null
          features?: string[] | null
          highlighted?: boolean | null
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          name: string
          price: number
          tier_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string | null
          created_at?: string
          created_by?: string | null
          cta?: string | null
          description?: string | null
          display_order?: number | null
          features?: string[] | null
          highlighted?: boolean | null
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          name?: string
          price?: number
          tier_id?: string | null
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
          status: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      project_approvals: {
        Row: {
          asset_url: string | null
          client_feedback: string | null
          created_at: string
          description: string | null
          id: string
          project_id: string
          requested_by: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["approval_status"]
          title: string
        }
        Insert: {
          asset_url?: string | null
          client_feedback?: string | null
          created_at?: string
          description?: string | null
          id?: string
          project_id: string
          requested_by?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          title: string
        }
        Update: {
          asset_url?: string | null
          client_feedback?: string | null
          created_at?: string
          description?: string | null
          id?: string
          project_id?: string
          requested_by?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_approvals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_deliverables: {
        Row: {
          created_at: string
          file_url: string
          id: string
          project_id: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          project_id: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          project_id?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_path: string
          file_type: string
          id: string
          project_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_path: string
          file_type: string
          id?: string
          project_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_path?: string
          file_type?: string
          id?: string
          project_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
        ]
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
      proposal_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          proposal_id: string
          quantity: number
          sort_order: number
          title: string
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          proposal_id: string
          quantity?: number
          sort_order?: number
          title: string
          total_price?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          proposal_id?: string
          quantity?: number
          sort_order?: number
          title?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_templates: {
        Row: {
          content: string
          created_at: string
          default_terms: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          default_terms?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          default_terms?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          client_id: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          lead_id: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          terms_and_conditions: string | null
          title: string
          total_amount: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          client_id?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          terms_and_conditions?: string | null
          title: string
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          client_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          terms_and_conditions?: string | null
          title?: string
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
          short_description: string | null
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
          short_description?: string | null
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
          short_description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      team_messages: {
        Row: {
          content: string | null
          created_at: string | null
          file_url: string | null
          id: string
          reactions: Json | null
          receiver_id: string | null
          reply_to: string | null
          seen_by: string[] | null
          sender_id: string
          type: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string
          reactions?: Json | null
          receiver_id?: string | null
          reply_to?: string | null
          seen_by?: string[] | null
          sender_id: string
          type?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string
          reactions?: Json | null
          receiver_id?: string | null
          reply_to?: string | null
          seen_by?: string[] | null
          sender_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "team_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      workflow_executions: {
        Row: {
          completed_at: string | null
          error: string | null
          id: string
          started_at: string
          status: string
          steps_completed: number | null
          trigger_data: Json | null
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          error?: string | null
          id?: string
          started_at?: string
          status?: string
          steps_completed?: number | null
          trigger_data?: Json | null
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          error?: string | null
          id?: string
          started_at?: string
          status?: string
          steps_completed?: number | null
          trigger_data?: Json | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string
          id: string
          step_order: number
          workflow_id: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          created_at?: string
          id?: string
          step_order?: number
          workflow_id: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string
          id?: string
          step_order?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_seen_by: {
        Args: { message_ids: string[]; user_id: string }
        Returns: undefined
      }
      generate_due_maintenance_invoices: { Args: never; Returns: undefined }
      get_unread_team_message_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_user_unread_count: {
        Args: { p_user_id: string; p_viewer_id: string }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      run_sql_query: { Args: { query: string }; Returns: Json }
    }
    Enums: {
      announcement_type: "general" | "urgent" | "event" | "hr"
      app_role: "admin" | "employee" | "client"
      application_status:
        | "applied"
        | "screening"
        | "interview"
        | "offer"
        | "hired"
        | "rejected"
      approval_status: "pending" | "approved" | "changes_requested"
      asset_condition: "new" | "good" | "fair" | "poor" | "damaged"
      asset_status:
        | "available"
        | "assigned"
        | "maintenance"
        | "retired"
        | "lost"
      client_ticket_status: "open" | "in_progress" | "resolved" | "closed"
      document_type: "contract" | "payslip" | "policy" | "tax" | "other"
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
      interview_status: "scheduled" | "completed" | "cancelled"
      invoice_status:
        | "draft"
        | "pending"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "cancelled"
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
      leave_status: "pending" | "approved" | "rejected" | "cancelled"
      leave_type:
        | "annual"
        | "sick"
        | "personal"
        | "unpaid"
        | "maternity"
        | "paternity"
        | "other"
      notification_module:
        | "system"
        | "crm"
        | "projects"
        | "hr"
        | "okr"
        | "proposals"
        | "finance"
      notification_type: "info" | "success" | "warning" | "error"
      okr_level: "company" | "department" | "individual"
      okr_status: "on_track" | "at_risk" | "off_track" | "completed"
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
      proposal_status: "draft" | "sent" | "viewed" | "accepted" | "rejected"
      ticket_category: "hardware" | "software" | "network" | "access" | "other"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status: "open" | "in_progress" | "resolved" | "closed"
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
      announcement_type: ["general", "urgent", "event", "hr"],
      app_role: ["admin", "employee", "client"],
      application_status: [
        "applied",
        "screening",
        "interview",
        "offer",
        "hired",
        "rejected",
      ],
      approval_status: ["pending", "approved", "changes_requested"],
      asset_condition: ["new", "good", "fair", "poor", "damaged"],
      asset_status: ["available", "assigned", "maintenance", "retired", "lost"],
      client_ticket_status: ["open", "in_progress", "resolved", "closed"],
      document_type: ["contract", "payslip", "policy", "tax", "other"],
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
      interview_status: ["scheduled", "completed", "cancelled"],
      invoice_status: [
        "draft",
        "pending",
        "partially_paid",
        "paid",
        "overdue",
        "cancelled",
      ],
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
      leave_status: ["pending", "approved", "rejected", "cancelled"],
      leave_type: [
        "annual",
        "sick",
        "personal",
        "unpaid",
        "maternity",
        "paternity",
        "other",
      ],
      notification_module: [
        "system",
        "crm",
        "projects",
        "hr",
        "okr",
        "proposals",
        "finance",
      ],
      notification_type: ["info", "success", "warning", "error"],
      okr_level: ["company", "department", "individual"],
      okr_status: ["on_track", "at_risk", "off_track", "completed"],
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
      proposal_status: ["draft", "sent", "viewed", "accepted", "rejected"],
      ticket_category: ["hardware", "software", "network", "access", "other"],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: ["open", "in_progress", "resolved", "closed"],
    },
  },
} as const
