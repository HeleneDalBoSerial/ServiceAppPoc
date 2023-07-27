import React from "react";
import { Navigate } from "react-router-dom";

function ProjectsPage() {
  return (
    <div className="card">
      {this.state.loginErrorMessage && (
        <div className="ms-Grid">
          <div>
            <div className="ms-Grid-row">
              <div className="ms-Grid-col">
                <h3>My projects</h3>
              </div>
            </div>
            <div className="ms-Grid-row">
              <div className="ms-Grid-col ms-sm12 ms-md12 ms-lg12">
                Le projet
              </div>
            </div>
          </div>
        </div>
      )}
      {this.state.redirect && <Navigate to="/projects" replace={true} />}
    </div>
  );
}

export default ProjectsPage;
