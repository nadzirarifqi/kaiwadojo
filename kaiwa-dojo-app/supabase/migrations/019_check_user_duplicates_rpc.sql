-- Migration 019: Create RPC function for pre-registration duplication check across auth.users and public.profiles

CREATE OR REPLACE FUNCTION check_user_duplicates(
  p_username TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS TABLE (
  username_exists BOOLEAN,
  email_exists BOOLEAN,
  phone_exists BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_clean_user TEXT := LOWER(TRIM(COALESCE(p_username, '')));
  v_clean_email TEXT := LOWER(TRIM(COALESCE(p_email, '')));
  v_raw_phone TEXT := TRIM(COALESCE(p_phone, ''));
  v_clean_phone TEXT := REGEXP_REPLACE(v_raw_phone, '[^0-9]', '', 'g');
  v_formatted_phone TEXT := v_clean_phone;
  v_user_dupe BOOLEAN := FALSE;
  v_email_dupe BOOLEAN := FALSE;
  v_phone_dupe BOOLEAN := FALSE;
BEGIN
  IF v_clean_phone LIKE '0%' THEN
    v_formatted_phone := '62' || SUBSTRING(v_clean_phone FROM 2);
  END IF;

  -- 1. Check Username (in profiles)
  IF v_clean_user <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles WHERE LOWER(username) = v_clean_user
    ) INTO v_user_dupe;
  END IF;

  -- 2. Check Email (in profiles AND auth.users)
  IF v_clean_email <> '' THEN
    SELECT (
      EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(email) = v_clean_email)
      OR
      EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = v_clean_email)
    ) INTO v_email_dupe;
  END IF;

  -- 3. Check Phone (in profiles)
  IF v_clean_phone <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE (phone_number IS NOT NULL AND phone_number <> '')
        AND (
          phone_number = v_raw_phone
          OR REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g') = v_clean_phone
          OR REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g') = v_formatted_phone
        )
    ) INTO v_phone_dupe;
  END IF;

  RETURN QUERY SELECT v_user_dupe, v_email_dupe, v_phone_dupe;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION check_user_duplicates(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
