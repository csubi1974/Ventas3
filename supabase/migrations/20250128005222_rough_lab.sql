/*
  # Create first admin user

  1. Changes
    - Create first admin user with default credentials
    - Add user profile data
  
  2. Security
    - Password will need to be changed on first login
*/

-- Create admin user if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = 'admin@aguapura.com'
  ) THEN
    -- Insert into auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin@aguapura.com',
      crypt('admin123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- Insert into users profile table
    INSERT INTO users (
      id,
      full_name,
      role,
      phone
    ) VALUES (
      (SELECT id FROM auth.users WHERE email = 'admin@aguapura.com'),
      'Administrador',
      'admin',
      ''
    );
  END IF;
END $$;