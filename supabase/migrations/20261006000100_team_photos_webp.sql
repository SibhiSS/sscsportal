-- Team photos moved from large PNGs to resized WebP copies (same names, ~6 MB -> 250 KB).
-- Points the seeded rows at the new files. Photos uploaded through the admin panel
-- (site-media bucket) and rows without a WebP copy are left alone.
UPDATE public.website_team
SET image = regexp_replace(image, '\.png$', '.webp')
WHERE image IN (
  '/abijay.png', '/arushi.png', '/goutham.png', '/harshan.png', '/hemanth.png',
  '/ilangkumaran.png', '/kiran.png', '/manasa.png', '/midhun.png', '/mrithubashini.png',
  '/neya.png', '/priyadharshini.png', '/sangeetha.png', '/shivaranjani.png', '/sibhi.png'
);
