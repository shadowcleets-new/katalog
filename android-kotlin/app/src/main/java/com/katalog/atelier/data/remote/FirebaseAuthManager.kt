package com.katalog.atelier.data.remote

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.UserProfileChangeRequest
import com.katalog.atelier.BuildConfig
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.tasks.await

data class AuthUserSession(
    val uid: String,
    val email: String,
    val displayName: String,
    val emailVerified: Boolean,
    val isOfflineLocalMode: Boolean = false
)

class FirebaseAuthManager(private val appContext: Context) {

    val isFirebaseConfigured: Boolean
        get() = FirebaseApp.getApps(appContext).isNotEmpty()

    private val auth: FirebaseAuth?
        get() = if (isFirebaseConfigured) FirebaseAuth.getInstance() else null

    fun observeAuthState(): Flow<AuthUserSession?> {
        val firebaseAuth = auth ?: return flowOf(null)
        return callbackFlow {
            val listener = FirebaseAuth.AuthStateListener { fa ->
                val user = fa.currentUser
                trySend(
                    user?.let {
                        AuthUserSession(
                            uid = it.uid,
                            email = it.email.orEmpty(),
                            displayName = it.displayName?.takeIf { n -> n.isNotBlank() }
                                ?: it.email?.substringBefore("@")
                                ?: "Atelier Staff",
                            emailVerified = it.isEmailVerified,
                            isOfflineLocalMode = false
                        )
                    }
                )
            }
            firebaseAuth.addAuthStateListener(listener)
            awaitClose { firebaseAuth.removeAuthStateListener(listener) }
        }
    }

    suspend fun signInWithEmail(email: String, password: String): Result<AuthUserSession> = runCatching {
        val firebaseAuth = auth ?: error("Add app/google-services.json to enable Firebase Auth.")
        val result = firebaseAuth.signInWithEmailAndPassword(email.trim(), password).await()
        val user = result.user ?: error("Sign-in succeeded without user profile.")
        AuthUserSession(
            uid = user.uid,
            email = user.email.orEmpty(),
            displayName = user.displayName?.takeIf { it.isNotBlank() }
                ?: user.email?.substringBefore("@")
                ?: "Atelier Staff",
            emailVerified = user.isEmailVerified
        )
    }

    suspend fun registerWithEmail(
        displayName: String,
        email: String,
        password: String
    ): Result<AuthUserSession> = runCatching {
        val firebaseAuth = auth ?: error("Add app/google-services.json to enable Firebase Auth.")
        val result = firebaseAuth.createUserWithEmailAndPassword(email.trim(), password).await()
        val user = result.user ?: error("Registration succeeded without user profile.")
        val cleanName = displayName.trim().ifBlank { email.substringBefore("@") }
        user.updateProfile(
            UserProfileChangeRequest.Builder().setDisplayName(cleanName).build()
        ).await()
        runCatching { user.sendEmailVerification().await() }
        AuthUserSession(
            uid = user.uid,
            email = user.email.orEmpty(),
            displayName = cleanName,
            emailVerified = user.isEmailVerified
        )
    }

    suspend fun signInWithGoogle(activityContext: Context): Result<AuthUserSession> = runCatching {
        val firebaseAuth = auth ?: error("Add app/google-services.json to enable Google Sign-In.")
        val credentialManager = CredentialManager.create(activityContext)
        val googleIdOption = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(BuildConfig.GOOGLE_WEB_CLIENT_ID)
            .setAutoSelectEnabled(false)
            .build()

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()

        val response = credentialManager.getCredential(activityContext, request)
        val credential = response.credential
        if (credential is CustomCredential &&
            credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
            val googleCred = GoogleIdTokenCredential.createFrom(credential.data)
            val firebaseCred = GoogleAuthProvider.getCredential(googleCred.idToken, null)
            val authResult = firebaseAuth.signInWithCredential(firebaseCred).await()
            val user = authResult.user ?: error("Google Sign-In did not return a Firebase user.")
            AuthUserSession(
                uid = user.uid,
                email = user.email.orEmpty(),
                displayName = user.displayName ?: googleCred.displayName ?: "Atelier Staff",
                emailVerified = user.isEmailVerified
            )
        } else {
            error("Unexpected credential type returned by Google Sign-In.")
        }
    }

    suspend fun sendVerificationEmail(): Result<Unit> = runCatching {
        val user = auth?.currentUser ?: error("No active signed-in account.")
        user.sendEmailVerification().await()
    }

    suspend fun reloadCurrentUser(): AuthUserSession? {
        val user = auth?.currentUser ?: return null
        runCatching { user.reload().await() }
        return AuthUserSession(
            uid = user.uid,
            email = user.email.orEmpty(),
            displayName = user.displayName ?: user.email?.substringBefore("@") ?: "Atelier Staff",
            emailVerified = user.isEmailVerified
        )
    }

    fun signOut() {
        auth?.signOut()
    }
}
