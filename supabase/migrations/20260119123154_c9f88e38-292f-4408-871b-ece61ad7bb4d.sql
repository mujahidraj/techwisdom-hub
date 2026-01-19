-- Create CMS tables: portfolio, services, pricing_tiers

-- Portfolio table for website portfolio
CREATE TABLE public.portfolio (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    project_url TEXT,
    category TEXT,
    technologies TEXT[],
    featured BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Services table for service listings
CREATE TABLE public.services (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    features TEXT[],
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Pricing tiers table for package details
CREATE TABLE public.pricing_tiers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL DEFAULT 0,
    billing_cycle TEXT DEFAULT 'one-time',
    features TEXT[],
    is_popular BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on all new tables
ALTER TABLE public.portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_tiers ENABLE ROW LEVEL SECURITY;

-- Portfolio policies
CREATE POLICY "Admins can manage portfolio"
ON public.portfolio FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view portfolio"
ON public.portfolio FOR SELECT
USING (true);

-- Services policies
CREATE POLICY "Admins can manage services"
ON public.services FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view active services"
ON public.services FOR SELECT
USING (is_active = true);

-- Pricing tiers policies
CREATE POLICY "Admins can manage pricing"
ON public.pricing_tiers FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view active pricing"
ON public.pricing_tiers FOR SELECT
USING (is_active = true);

-- Add triggers for updated_at
CREATE TRIGGER update_portfolio_updated_at
    BEFORE UPDATE ON public.portfolio
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_services_updated_at
    BEFORE UPDATE ON public.services
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pricing_tiers_updated_at
    BEFORE UPDATE ON public.pricing_tiers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();