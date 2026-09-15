UPDATE markets
SET feature_flags = json_set(
  coalesce(feature_flags, '{}'),
  '$.communityOperations',
  json('true')
)
WHERE code = 'DZ';
