-- Policy: Allow authenticated users or anonymous to delete files from the secure-shares bucket
-- WARNING: Since this vault is accessible by anyone, allowing anonymous deletes means ANY visitor can delete your files.
-- If you want to restrict deletion to only yourself, you should setup Supabase Authentication and change the policy.
create policy "Allow Public Deletes" 
on storage.objects for delete 
using ( bucket_id = 'secure-shares' );
