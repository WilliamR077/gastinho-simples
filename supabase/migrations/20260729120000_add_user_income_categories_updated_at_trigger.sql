CREATE TRIGGER update_user_income_categories_updated_at
BEFORE UPDATE ON public.user_income_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
