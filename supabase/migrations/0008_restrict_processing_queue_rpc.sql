revoke execute on function public.claim_processing_characters(text, int) from public;
revoke execute on function public.claim_processing_characters(text, int) from anon;
revoke execute on function public.claim_processing_characters(text, int) from authenticated;
grant execute on function public.claim_processing_characters(text, int) to service_role;
