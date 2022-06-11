#!/usr/bin/env bash

TPUT_RESET=""
TPUT_WHITE=""
TPUT_BGRED=""
TPUT_RED=""
TPUT_GREEN=""
TPUT_BGGREEN=""
TPUT_BOLD=""
TPUT_DIM=""

# Is stderr on the terminal? If not, then fail
test -t 2 || return 1

if command -v tput > /dev/null 2>&1; then
  if [ $(($(tput colors 2> /dev/null))) -ge 8 ]; then
    # Enable colors
    TPUT_RESET="$(tput sgr 0)"
    TPUT_WHITE="$(tput setaf 7)"
    TPUT_BGRED="$(tput setab 1)"
    TPUT_BGGREEN="$(tput setab 2)"
    TPUT_GREEN="$(tput setaf 2)"
    TPUT_RED="$(tput setaf 1)"
    TPUT_BOLD="$(tput bold)"
    TPUT_DIM="$(tput dim)"
  fi
fi

warning(){
  echo
  printf "%s\n\n" "${TPUT_BGRED}${TPUT_WHITE}${TPUT_BOLD} WARNING ${TPUT_RESET} ${*}"
}

message(){
  echo
  printf "%s\n\n" "${TPUT_BGGREEN}${TPUT_WHITE}${TPUT_BOLD} INFO ${TPUT_RESET} ${*}"
}

announce() {
    echo -----------------------------------------------------------------------------
    echo -e "${TPUT_BOLD}${*}${TPUT_RESET}"
    echo -----------------------------------------------------------------------------
    echo
}

