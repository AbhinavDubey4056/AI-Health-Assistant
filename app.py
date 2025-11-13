import streamlit as st
import pandas as pd
import numpy as np
import joblib
import shap
import matplotlib.pyplot as plt

# --------------------------
# Load model + symptom columns
# --------------------------
model = joblib.load("disease_prediction_best_model.pkl")
symptom_columns = joblib.load("symptom_columns.pkl")

# --------------------------
# Streamlit configuration
# --------------------------
st.set_page_config(
    page_title="AI Health Disease Detector",
    page_icon="🧬",
    layout="centered",
)

# --------------------------
# Custom CSS for dark UI and cards
# --------------------------
st.markdown("""
<style>
body { background-color: #0E1117; color: #FAFAFA; }
.card {
    background-color: #1E1E1E;
    padding: 1.2rem;
    border-radius: 1rem;
    box-shadow: 0 0 15px rgba(255,255,255,0.03);
    margin-bottom: 1rem;
}
h1, h2, h3, h4 { color: #FAFAFA; }
.small { font-size: 0.9rem; color:#cfcfcf; }
</style>
""", unsafe_allow_html=True)

# --------------------------
# Header
# --------------------------
st.title("🩺 AI Health Disease Predictor")
st.caption("Select symptoms to predict the most likely disease and see an explainability breakdown.")

# --------------------------
# Symptom selection
# --------------------------
st.markdown('<div class="card">', unsafe_allow_html=True)
st.subheader("Step 1: Select Symptoms")
selected_symptoms = st.multiselect(
    "Choose all that apply:",
    symptom_columns,
    help="You can select multiple symptoms."
)
st.markdown("</div>", unsafe_allow_html=True)

# --------------------------
# Predict & Explain
# --------------------------
if st.button("🔍 Predict & Explain", use_container_width=True):
    if not selected_symptoms:
        st.warning("Please select at least one symptom before predicting.")
    else:
        input_data = [1 if s in selected_symptoms else 0 for s in symptom_columns]
        input_df = pd.DataFrame([input_data], columns=symptom_columns)

        # Model prediction
        try:
            prediction = model.predict(input_df)[0]
        except Exception as e:
            st.error(f"Model prediction failed: {e}")
            raise

        st.markdown('<div class="card">', unsafe_allow_html=True)
        st.subheader("🧬 Predicted Result")
        st.success(f"**{prediction}**")

        # Probabilities / Top-3
        if hasattr(model, "predict_proba"):
            proba = model.predict_proba(input_df)[0]
            top_idx = np.argsort(proba)[::-1][:3]

            st.write("### Confidence Overview:")
            for i in top_idx:
                st.write(f"**{model.classes_[i]}**")
                st.progress(int(proba[i] * 100))
                st.caption(f"{proba[i]*100:.2f}% confidence")

        st.markdown("</div>", unsafe_allow_html=True)

        # --------------------------
        # SHAP Explainability (robust to shapes)
        # --------------------------
        st.markdown('<div class="card">', unsafe_allow_html=True)
        st.subheader("🧠 Why did the model predict this?")

        try:
            # Prepare background and input
            background = pd.DataFrame(np.zeros((1, len(symptom_columns))), columns=symptom_columns)
            input_array = np.array(input_df).reshape(1, -1)
            input_data_named = pd.DataFrame(input_array, columns=symptom_columns)

            # Build unified explainer and compute shap values (disable additivity)
            explainer = shap.Explainer(model, background)
            shap_result = explainer(input_data_named, check_additivity=False)

            # Determine predicted class index (if multi-class)
            try:
                pred_index = int(np.where(model.classes_ == prediction)[0][0])
            except Exception:
                pred_index = 0

            # Extract a 1-D SHAP array for the predicted class robustly:
            # shap_result.values can be a list, or ndarray with dims:
            #  - list of arrays: one per class (older SHAP)
            #  - ndarray (n_samples, n_outputs, n_features) (newer SHAP)
            #  - ndarray (n_samples, n_features) for regression/binary
            vals = shap_result.values

            if isinstance(vals, list):
                # older API: list of arrays (one per class)
                arr = vals[pred_index]  # arr shape likely (n_samples, n_features)
                if isinstance(arr, np.ndarray) and arr.ndim == 2:
                    shap_arr = arr[0]
                else:
                    # fallback: convert to numpy and flatten
                    shap_arr = np.array(arr).reshape(-1)[:len(symptom_columns)]
            else:
                # ndarray
                vals = np.array(vals)
                if vals.ndim == 3:
                    # shape (n_samples, n_outputs, n_features)
                    shap_arr = vals[0, pred_index, :]
                elif vals.ndim == 2:
                    # shape (n_samples, n_features)
                    shap_arr = vals[0]
                else:
                    # unexpected shape — flatten try
                    shap_arr = vals.flatten()[:len(symptom_columns)]

            # Now shap_arr should be 1D with length == len(symptom_columns)
            if shap_arr.shape[0] != len(symptom_columns):
                # If length mismatch, try to truncate/extend with zeros
                tmp = np.zeros(len(symptom_columns))
                tmp[:min(len(shap_arr), len(tmp))] = shap_arr[:min(len(shap_arr), len(tmp))]
                shap_arr = tmp

            # Build shap DataFrame and pick top-k
            shap_df = pd.DataFrame({
                "Symptom": symptom_columns,
                "SHAP Value": shap_arr
            })
            shap_df = shap_df.reindex(shap_df["SHAP Value"].abs().sort_values(ascending=False).index)
            top_shap = shap_df.head(10).copy()

            st.write("**Top contributing symptoms (by absolute SHAP value):**")
            st.dataframe(top_shap.reset_index(drop=True), use_container_width=True)

            # Horizontal bar plot (colored by sign)
            labels = top_shap["Symptom"].values[::-1]
            scores = top_shap["SHAP Value"].values[::-1]
            colors = ["#ef476f" if v < 0 else "#06d6a0" for v in scores]  # negative red-ish, positive green-ish

            fig, ax = plt.subplots(figsize=(6, 3 + 0.25 * len(labels)))
            y_pos = np.arange(len(labels))
            ax.barh(y_pos, scores, color=colors, edgecolor='k', height=0.6)
            ax.set_yticks(y_pos)
            ax.set_yticklabels(labels)
            ax.set_xlabel("SHAP value (impact on model output)")
            ax.axvline(0, color="gray", linewidth=0.8)
            ax.set_title("Top contributing symptoms for the predicted class")
            plt.tight_layout()
            st.pyplot(fig)

        except Exception as e:
            st.error(f"SHAP explanation could not be generated: {e}")

        st.markdown("</div>", unsafe_allow_html=True)

# --------------------------
# Footer
# --------------------------
st.markdown("---")
st.caption("⚕️ Built with Streamlit · Explainability powered by SHAP · Model trained using Scikit-learn")
