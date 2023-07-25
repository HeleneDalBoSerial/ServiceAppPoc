import React from "react";
import { useNavigate } from "react-router-dom";
import { RouteParams } from "../routes";

function Header() {
  const navigate = useNavigate();
  const logo =
    "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyB2aWV3Qm94PSIyOC45NTEgMjYuNTg4IDI4Mi44MzYgMjE2Ljg0MSIgd2lkdGg9IjI4Mi44MzYiIGhlaWdodD0iMjE2Ljg0MSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLCAwLCAwLCAxLCAxMTkuOTE2MDc2NjYwMTU2MjUsIC0yOTMuNTgyMjc1MzkwNjI1KSIgaWQ9ImxheWVyMSI+CiAgICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgzNS40MzMwOTMsMzUuNDI2ODU3KSIgaWQ9ImcyNzY2Ij4KICAgICAgPHBhdGggZD0iTSA1Mi4xNTY4OTQsNDkzLjY5NTM2IEwgMjYuMjgxNzg0LDQzMy4xNjI5NyBMIC0xOS40MzYxNDYsNDMzLjE2Mjk3IEwgOS42MTY2MTQzLDM3MC45NDU3MyBMIDY1LjE3MzAyNCw0OTMuNjk1MzYgTCAxNDMuMjY5NzYsNDkzLjY5NTM2IEwgNDMuMTA0MTA0LDI5My41ODIyOSBMIC0yNS40Njg0MzYsMjkzLjU4MjI5IEwgLTExOS45MTYwOCw0OTMuNjk1MzYgTCA1Mi4xNTY4OTQsNDkzLjY5NTM2IHoiIGlkPSJwYXRoMjQ2MiIgc3R5bGU9ImZpbGw6IzAwNmRiMDtmaWxsLW9wYWNpdHk6MTtmaWxsLXJ1bGU6bm9uemVybztzdHJva2U6bm9uZSIvPgogICAgPC9nPgogIDwvZz4KPC9zdmc+";

  const goBack = () => {
    if (location.state && location.state[RouteParams.backPaths] !== undefined) {
      const backpath = location.state[RouteParams.backPaths];
      let options = {};
      const currentRedirection = backpath[0];

      if (backpath.length > 1) {
        backpath.shift();
        options = { state: { backPaths: backpath } };
      }
      navigate(currentRedirection, options);
    } else {
      navigate(-1);
    }
  };
  return (
    <header className="header">
      <div className="header_content">
        <img src={logo} className="logo" />
      </div>
    </header>
  );
}

export default Header;
