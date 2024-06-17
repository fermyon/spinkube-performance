use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2, Params,
};

use spin_sdk::http::{IntoResponse, Request, Response};
use spin_sdk::http_component;

#[http_component]
fn handle_request(req: Request) -> anyhow::Result<impl IntoResponse> {
    let mut password: String = "boson42".to_string();
    let mut iterations: u32 = 5;
    let mut mem_kib: u32 = 1000;

    let parsed_url = url::Url::parse(req.uri()).unwrap();
    let hash_query: std::collections::HashMap<_, _> =
        parsed_url.query_pairs().into_owned().collect();

    for (key, value) in hash_query.into_iter() {
        // ex: ?sleep=1000&cpu=1000&mem=1000&password=foo
        match &*key {
            // sleep=<ms> param simulates generic i/o time
            "sleep" => {
                let ms = value.parse().expect("invalid sleep");
                std::thread::sleep(std::time::Duration::from_millis(ms));
            }
            // password=<password> param is the user-supplied password
            "password" => {
                password = value.parse::<String>().expect("invalid password string");
            }
            // cpu=<iterations> param increases compute time
            "cpu" => {
                iterations = value.parse().expect("invalid cpu iteration count");
            }
            // mem=<KiB> param increases memory usage
            "mem" => {
                mem_kib = value.parse().expect("invalid KiB count for memory");
            }
            _ => (),
        }
    }

    let password_hash = hash_password(password, mem_kib, iterations);

    Ok(Response::builder().status(200).body(password_hash).build())
}

fn hash_password(password: String, mem_kib: u32, iterations: u32) -> String {
    let parallelism: u32 = 1;
    let output_len: Option<usize> = Some(32);

    let params = Params::new(mem_kib, iterations, parallelism, output_len)
        .expect("unable to construct argon2 params");
    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);

    let salt = SaltString::generate(&mut OsRng);
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .expect("unable to hash password")
        .to_string();
    let parsed_hash = PasswordHash::new(&password_hash).expect("unable to parse password hash");
    argon2
        .verify_password(password.as_bytes(), &parsed_hash)
        .expect("password failed verification with PHC string");

    password_hash
}
