import React, { useState, Suspense } from "react";
import { useDispatch } from "react-redux";
import { LoadingIndicator, Validator } from "../../utilities";
import { forgotpassword } from "action/UserAct";
import "./styles.scss";
import { Link } from "react-router-dom";
import { Toast } from "service/toast";
import { imageURLs } from "utilities/imageURLs";
export default function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [, forceUpdate] = useState(false);
  const dispatch = useDispatch();
  const [, setError] = useState(false);
  const validator = Validator();
  const submitLogin = (e) => {
    e.preventDefault();
    if (validator.current.allValid()) {
      setLoading(true);
      let response = dispatch(
        forgotpassword({
          email: username,
          clientUrl: window.location.origin,
        })
      );
      response
        .then((res) => {
          if (res.success) {
            setLoading(false);
            setError("");
            Toast({ type: "success", message: res.message, time: 4000 });
          } else {
            Toast({ type: "error", message: res.message, time: 4000 });
          }
        })
        .catch((e) => {
          setLoading(false);
        });
    } else {
      validator.current.showMessages();
      forceUpdate(true);
    }
  };

  return (
    <Suspense fallback='Loading'>
      <div className="container-fluid row m-0 p-0 vh-100">
        <div className="col-md-6 col-xs-12 col-sm-12 text-center pt-lg-5 mt-lg-5">
          <div className="pt-5">
            <img className="logo1" src={imageURLs.Logo} alt="Logo" width={330} />
          </div>
          <div className="row mt-3">
            <div className="col-md-9 col-lg-9 col-sm-12 col-xs-12 mx-auto">
              <h2 className="mb-5">
                Forgot Password
              </h2>
              <form onSubmit={submitLogin} className="pr-lg-5 pl-lg-5">
                <div
                  className="form-group d-flex flex-column"
                  style={{ textAlign: "start" }}
                >
                  <label className="label2 fs13 ">Enter your email*</label>
                  <input
                    style={{ borderRadius: "40px" }}
                    type="email"
                    className="form-control border"
                    id="username"
                    name="username"
                    autoComplete="off"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  <span className="text-warning">
                    {validator.current.message(
                      "Email ",
                      username,
                      "required|email"
                    )}
                  </span>
                </div>
                <button
                  className="font-weight-bold text-uppercase w-100 text-white border-0 login2"
                  style={{
                    backgroundColor: "#466657",
                    borderRadius: "40px",
                    height: "40px",
                  }}
                  type={loading ? "button" : "submit"}
                  disabled={loading}
                >
                  {loading ? "Submitting..." : "Submit"} {loading ? <LoadingIndicator size={"1"} /> : null}
                </button>
              </form>
              <Link to="/auth/login" className="text-decoration-none register2 fs-12">
                <span> Go back to Login</span>
              </Link>
            </div>
          </div>
        </div>
        <div className="col-md-6 p-0 m-0 bg-biscuit text-center pt-4 pb-4 d-none d-lg-block">
          <h5 className="text-green font-weight-bold mt-2">WELCOME TO VIHANGA</h5>
          <h3 className="mt-3">Find The Most Exciting OKR Experience<br />
            For Your Business</h3>
          <div className="d-flex justify-content-center">
            <div className="col-md-10">
              <img className="img-fluid p-3" src={imageURLs.logobg} alt="Logo" />
            </div>
          </div>
        </div>
      </div>
    </Suspense>
  );
}
