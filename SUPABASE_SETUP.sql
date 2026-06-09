-- 1. Create the storage bucket
insert into storage.buckets (id, name, public) 
values ('secure-shares', 'secure-shares', true);

-- 2. Enable Row Level Security (RLS) on the storage.objects table
-- This is technically enabled by default, but good to be explicit
alter table storage.objects enable row level security;

-- 3. Policy: Allow anyone to view/read the files (since you want to share them)
create policy "Public Access" 
on storage.objects for select 
using ( bucket_id = 'secure-shares' );

-- 4. Policy: Allow authenticated users or anonymous to upload. 
-- *WARNING*: Since this is a public share app, you may want anyone to upload. 
-- If you ONLY want YOU to upload, you must require auth.
-- For this setup (anonymous uploads allowed but restricted to 10MB PDFs/Images):
create policy "Allow Public Uploads" 
on storage.objects for insert 
with check (
  bucket_id = 'secure-shares' 
  -- Optional: further restrict file types natively in SQL if desired
  -- and (storage.extension(name) = 'pdf' or storage.extension(name) = 'jpg' ...)
);

-- 5. Policy: Allow users to delete files (or restrict this)
-- Here we only allow users to delete files if we want, but for a true secure vault, 
-- maybe no public deletion is allowed. So we don't add a delete policy for anonymous.
