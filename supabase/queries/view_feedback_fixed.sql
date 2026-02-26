-- View all feedback (basic version without user details)
-- This query will work with restricted permissions
SELECT 
  f.id,
  f.user_id,
  f.content,
  f.category,
  f.rating,
  f.created_at,
  f.extra_data
FROM public.user_feedback f
ORDER BY f.created_at DESC;

-- View average feedback rating by category
-- This query will work with restricted permissions
SELECT 
  category,
  COUNT(*) as feedback_count,
  ROUND(AVG(rating), 2) as average_rating
FROM public.user_feedback
GROUP BY category
ORDER BY average_rating DESC;

-- View feedback with screenshots
-- This query will work with restricted permissions
SELECT 
  f.id,
  f.user_id,
  f.category,
  f.rating,
  f.content,
  f.created_at,
  f.extra_data->'screenshot' as screenshot_url
FROM public.user_feedback f
WHERE f.extra_data->>'screenshot' IS NOT NULL
ORDER BY f.created_at DESC;

-- View feedback with device information
-- This query will work with restricted permissions
SELECT 
  f.id,
  f.user_id,
  f.category,
  f.rating,
  f.content,
  f.created_at,
  f.extra_data->'device_info'->>'deviceType' as device_type,
  f.extra_data->'device_info'->>'brand' as brand,
  f.extra_data->'device_info'->>'modelName' as model,
  f.extra_data->'device_info'->>'osName' as os_name,
  f.extra_data->'device_info'->>'osVersion' as os_version
FROM public.user_feedback f
WHERE f.extra_data->>'device_info' IS NOT NULL
ORDER BY f.created_at DESC;

-- View feedback with low ratings (1-2) for priority action
-- This query will work with restricted permissions
SELECT 
  f.id,
  f.user_id,
  f.category,
  f.rating,
  f.content,
  f.created_at
FROM public.user_feedback f
WHERE f.rating <= 2
ORDER BY f.created_at DESC;

-- ADMIN ONLY: If you need user details and have admin access
-- Note: These queries require access to auth.users and should only be used
-- in admin contexts with proper permissions (e.g., through a secure server function)

/*
-- Admin view with user details (requires admin permissions)
SELECT 
  f.id,
  f.user_id,
  u.email as user_email,
  u.raw_user_meta_data->>'firstName' as first_name,
  u.raw_user_meta_data->>'lastName' as last_name,
  f.content,
  f.category,
  f.rating,
  f.created_at,
  f.extra_data
FROM public.user_feedback f
JOIN auth.users u ON f.user_id = u.id
ORDER BY f.created_at DESC;
*/ 