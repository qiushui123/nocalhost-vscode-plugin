import React, { useContext, useEffect, useRef } from "react";
import { createStyles, makeStyles } from "@material-ui/core";
import hljs from "highlight.js";
import { store } from "../../store/store";
import { CustomThemeOptions } from "../../themes";
import { ThemeType } from "../../constants";

const useStyles = makeStyles((theme: CustomThemeOptions) =>
  createStyles({
    root: {
      width: "100%",
      height: "100%",
      overflowX: "hidden",
      overflowY: "auto",
      "&:hover": {
        "& div.logs-anthor": {
          display: "none",
        },
      },
    },
    noContent: {
      width: "100%",
      height: "100%",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    },
    list: {
      padding: 10,
    },
    line: {
      "&:before": {
        display: "inline-block",
        content: "attr(data-line)",
        marginRight: 12,
        color: theme.palette?.text?.hint,
        minWidth: 25,
        textAlign: "right",
      },
    },
  })
);

const Logs: React.FC = () => {
  const {
    state: { logs, theme },
  } = useContext(store);
  const elementRef: React.MutableRefObject<HTMLDivElement | null> = useRef(
    null
  );
  const classes = useStyles();

  const renderNoContent = () => (
    <div className={classes.noContent}>No Content.</div>
  );
  const renderList = () => {
    return (
      <>
        <ul className={classes.list}>
          {logs.items.map((text: string, i: number) => {
            hljs.configure({});
            const result = hljs.highlight("haskell", text);
            return (
              <li
                key={i}
                data-line={i + 1}
                dangerouslySetInnerHTML={{ __html: result.value }}
                className={classes.line}
              ></li>
            );
          })}
        </ul>
        <div className="logs-anthor" ref={elementRef}></div>
      </>
    );
  };

  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [logs]);

  useEffect(() => {
    const $link = document.getElementById("syntax-theme");
    if (!$link) {
      return;
    }
    const { light, dark } = $link.dataset;
    if (theme === ThemeType.light) {
      $link.setAttribute("href", light);
    } else {
      $link.setAttribute("href", dark);
    }
  }, [theme]);

  return (
    <div className={classes.root}>
      {logs.items.length > 0 ? renderList() : renderNoContent()}
    </div>
  );
};

export default Logs;