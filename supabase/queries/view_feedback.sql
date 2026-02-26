-- View all feedback with user details
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

-- View average feedback rating by category
SELECT 
  category,
  COUNT(*) as feedback_count,
  ROUND(AVG(rating), 2) as average_rating
FROM public.user_feedback
GROUP BY category
ORDER BY average_rating DESC;

-- View feedback with screenshots
SELECT 
  f.id,
  f.user_id,
  u.email as user_email,
  f.category,
  f.rating,
  f.content,
  f.created_at,
  f.extra_data->'screenshot' as screenshot_url
FROM public.user_feedback f
JOIN auth.users u ON f.user_id = u.id
WHERE f.extra_data->>'screenshot' IS NOT NULL
ORDER BY f.created_at DESC;

-- View feedback with device information
SELECT 
  f.id,
  f.user_id,
  u.email as user_email,
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
JOIN auth.users u ON f.user_id = u.id
WHERE f.extra_data->>'device_info' IS NOT NULL
ORDER BY f.created_at DESC;

-- View feedback with low ratings (1-2) for priority action
SELECT 
  f.id,
  f.user_id,
  u.email as user_email,
  f.category,
  f.rating,
  f.content,
  f.created_at
FROM public.user_feedback f
JOIN auth.users u ON f.user_id = u.id
WHERE f.rating <= 2
ORDER BY f.created_at DESC; 