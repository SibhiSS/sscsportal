-- Optional second photo per team member; clicking the photo on /team flips between the two.
ALTER TABLE public.website_team ADD COLUMN IF NOT EXISTS image2 text;
